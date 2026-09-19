use std::{
    collections::{BTreeMap, VecDeque},
    error::Error,
    fmt,
    io::{Read, Write},
    net::{Shutdown, TcpStream},
    sync::{mpsc, Arc, Condvar, Mutex},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

const DEFAULT_MAX_PENDING: usize = 64;
const OWNER_RETRY: Duration = Duration::from_millis(1);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HostTransportError {
    InvalidResource,
    Limit,
    Busy,
    Bounds,
    Cancelled,
    Timeout,
    ExternalFailure,
    AlreadyTerminal,
}

impl fmt::Display for HostTransportError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Host transport: {self:?}")
    }
}

impl Error for HostTransportError {}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Transfer {
    pub transferred: u32,
    pub eof: bool,
    pub message_complete: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Terminal {
    Transfer(Transfer),
    Synchronized,
    Closed,
}

#[derive(Debug)]
pub struct HostOperation {
    id: u64,
    owner: u64,
    claimed: bool,
}

impl HostOperation {
    pub fn id(&self) -> u64 {
        self.id
    }
}

#[derive(Debug, Clone)]
pub struct HostWindow {
    bytes: Arc<Mutex<Vec<u8>>>,
    capacity: usize,
}

impl HostWindow {
    pub fn acquire(capacity: u32) -> Result<Self, HostTransportError> {
        let capacity = capacity as usize;
        if capacity == 0 {
            return Err(HostTransportError::Bounds);
        }
        Ok(Self {
            bytes: Arc::new(Mutex::new(Vec::new())),
            capacity,
        })
    }

    pub fn commit(
        &mut self,
        initialized: &[u8],
        valid_bytes: u32,
    ) -> Result<(), HostTransportError> {
        let valid = valid_bytes as usize;
        if valid > initialized.len() || valid > self.capacity {
            return Err(HostTransportError::Bounds);
        }
        let mut bytes = self.bytes.lock().unwrap();
        bytes.clear();
        bytes.extend_from_slice(&initialized[..valid]);
        Ok(())
    }

    pub fn copy_out(&self) -> Vec<u8> {
        self.bytes.lock().unwrap().clone()
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct HostTransportMetrics {
    pub operations_issued: u64,
    pub waits: u64,
    pub results_claimed: u64,
    pub read_operations: u64,
    pub write_operations: u64,
    pub read_bytes: u64,
    pub write_bytes: u64,
    pub partial_writes: u64,
    pub eof_transfers: u64,
    pub pending_issued: u64,
    pub pending_peak: u64,
    pub cancellations: u64,
    pub timeouts: u64,
    pub backpressure_rejections: u64,
    pub owner_wake_cycles: u64,
    pub owner_threads_started: u64,
    pub reactor_poll_calls: u64,
    pub reactor_readiness_events: u64,
}

#[derive(Debug)]
enum PendingKind {
    Read {
        destination: Arc<Mutex<Vec<u8>>>,
        capacity: usize,
        length: usize,
    },
    Write {
        bytes: Vec<u8>,
    },
}

#[derive(Debug)]
struct PendingOperation {
    id: u64,
    deadline: Instant,
    kind: PendingKind,
}

enum Command {
    Issue(PendingOperation),
    Cancel(u64),
    Stop,
}

struct Shared {
    completions: BTreeMap<u64, Result<Terminal, HostTransportError>>,
    pending: usize,
    closed: bool,
    metrics: HostTransportMetrics,
}

struct SharedState {
    state: Mutex<Shared>,
    changed: Condvar,
}

impl SharedState {
    fn complete(&self, id: u64, result: Result<Terminal, HostTransportError>) {
        let mut shared = self.state.lock().unwrap();
        if shared.pending > 0 {
            shared.pending -= 1;
        }
        shared.completions.insert(id, result);
        self.changed.notify_all();
    }
}

fn classify_external(error: &std::io::Error) -> HostTransportError {
    match error.kind() {
        std::io::ErrorKind::TimedOut => HostTransportError::Timeout,
        _ => HostTransportError::ExternalFailure,
    }
}

fn drive_one(
    stream: &mut TcpStream,
    operation: &PendingOperation,
    max_write_chunk: usize,
    shared: &Arc<SharedState>,
) -> Option<Result<Terminal, HostTransportError>> {
    match &operation.kind {
        PendingKind::Read {
            destination,
            capacity,
            length,
        } => {
            let mut scratch = vec![0u8; *length];
            match stream.read(&mut scratch) {
                Ok(n) => {
                    let mut target = destination.lock().unwrap();
                    if n > *capacity {
                        return Some(Err(HostTransportError::Bounds));
                    }
                    target.clear();
                    target.extend_from_slice(&scratch[..n]);
                    let mut state = shared.state.lock().unwrap();
                    state.metrics.read_operations = state.metrics.read_operations.saturating_add(1);
                    state.metrics.read_bytes = state.metrics.read_bytes.saturating_add(n as u64);
                    if n == 0 {
                        state.metrics.eof_transfers = state.metrics.eof_transfers.saturating_add(1);
                    }
                    Some(Ok(Terminal::Transfer(Transfer {
                        transferred: n as u32,
                        eof: n == 0,
                        message_complete: false,
                    })))
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => None,
                Err(error) => Some(Err(classify_external(&error))),
            }
        }
        PendingKind::Write { bytes } => {
            let physical = &bytes[..bytes.len().min(max_write_chunk)];
            match stream.write(physical) {
                Ok(0) => Some(Err(HostTransportError::ExternalFailure)),
                Ok(n) => {
                    if let Err(error) = stream.flush() {
                        return Some(Err(classify_external(&error)));
                    }
                    let mut state = shared.state.lock().unwrap();
                    state.metrics.write_operations =
                        state.metrics.write_operations.saturating_add(1);
                    state.metrics.write_bytes = state.metrics.write_bytes.saturating_add(n as u64);
                    if n < bytes.len() {
                        state.metrics.partial_writes =
                            state.metrics.partial_writes.saturating_add(1);
                    }
                    Some(Ok(Terminal::Transfer(Transfer {
                        transferred: n as u32,
                        eof: false,
                        message_complete: n == bytes.len(),
                    })))
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => None,
                Err(error) => Some(Err(classify_external(&error))),
            }
        }
    }
}

fn owner_loop(
    mut stream: TcpStream,
    commands: mpsc::Receiver<Command>,
    shared: Arc<SharedState>,
    max_write_chunk: usize,
) {
    let mut pending = VecDeque::<PendingOperation>::new();
    let mut stopping = false;
    loop {
        {
            let mut state = shared.state.lock().unwrap();
            state.metrics.owner_wake_cycles = state.metrics.owner_wake_cycles.saturating_add(1);
        }
        loop {
            match commands.try_recv() {
                Ok(Command::Issue(operation)) => pending.push_back(operation),
                Ok(Command::Cancel(id)) => {
                    if let Some(index) = pending.iter().position(|operation| operation.id == id) {
                        let operation = pending.remove(index).unwrap();
                        {
                            let mut state = shared.state.lock().unwrap();
                            state.metrics.cancellations =
                                state.metrics.cancellations.saturating_add(1);
                        }
                        shared.complete(operation.id, Err(HostTransportError::Cancelled));
                    }
                }
                Ok(Command::Stop) => stopping = true,
                Err(mpsc::TryRecvError::Empty) => break,
                Err(mpsc::TryRecvError::Disconnected) => {
                    stopping = true;
                    break;
                }
            }
        }

        let now = Instant::now();
        let count = pending.len();
        for _ in 0..count {
            let operation = pending.pop_front().unwrap();
            if now >= operation.deadline {
                {
                    let mut state = shared.state.lock().unwrap();
                    state.metrics.timeouts = state.metrics.timeouts.saturating_add(1);
                }
                shared.complete(operation.id, Err(HostTransportError::Timeout));
                continue;
            }
            if let Some(result) = drive_one(&mut stream, &operation, max_write_chunk, &shared) {
                shared.complete(operation.id, result);
            } else {
                pending.push_back(operation);
            }
        }

        if stopping {
            while let Some(operation) = pending.pop_front() {
                shared.complete(operation.id, Err(HostTransportError::Cancelled));
            }
            let _ = stream.shutdown(Shutdown::Both);
            let mut state = shared.state.lock().unwrap();
            state.closed = true;
            shared.changed.notify_all();
            return;
        }

        if pending.is_empty() {
            match commands.recv_timeout(Duration::from_millis(20)) {
                Ok(Command::Issue(operation)) => pending.push_back(operation),
                Ok(Command::Cancel(_)) => {}
                Ok(Command::Stop) => stopping = true,
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => stopping = true,
            }
        } else {
            thread::sleep(OWNER_RETRY);
        }
    }
}

pub struct HostEndpoint {
    owner: u64,
    commands: mpsc::SyncSender<Command>,
    wake_stream: TcpStream,
    worker: Option<JoinHandle<()>>,
    shared: Arc<SharedState>,
    next_operation: u64,
    operation_timeout: Duration,
    max_pending: usize,
}

impl HostEndpoint {
    pub fn from_accepted_tcp(
        stream: TcpStream,
        read_timeout: Duration,
        write_timeout: Duration,
    ) -> Result<Self, Box<dyn Error>> {
        Self::from_accepted_tcp_with_limits(
            stream,
            read_timeout.min(write_timeout),
            usize::MAX,
            DEFAULT_MAX_PENDING,
        )
    }

    pub fn from_accepted_tcp_with_write_limit(
        stream: TcpStream,
        read_timeout: Duration,
        write_timeout: Duration,
        max_write_chunk: usize,
    ) -> Result<Self, Box<dyn Error>> {
        Self::from_accepted_tcp_with_limits(
            stream,
            read_timeout.min(write_timeout),
            max_write_chunk,
            DEFAULT_MAX_PENDING,
        )
    }

    pub fn from_accepted_tcp_with_limits(
        stream: TcpStream,
        operation_timeout: Duration,
        max_write_chunk: usize,
        max_pending: usize,
    ) -> Result<Self, Box<dyn Error>> {
        if max_write_chunk == 0 || max_pending == 0 || operation_timeout.is_zero() {
            return Err(HostTransportError::Bounds.into());
        }
        stream.set_nonblocking(true)?;
        let wake_stream = stream.try_clone()?;
        let (commands, queue) = mpsc::sync_channel(max_pending);
        let shared = Arc::new(SharedState {
            state: Mutex::new(Shared {
                completions: BTreeMap::new(),
                pending: 0,
                closed: false,
                metrics: HostTransportMetrics {
                    owner_threads_started: 1,
                    ..HostTransportMetrics::default()
                },
            }),
            changed: Condvar::new(),
        });
        let owner = Arc::as_ptr(&shared) as usize as u64;
        let worker_shared = shared.clone();
        let worker =
            thread::spawn(move || owner_loop(stream, queue, worker_shared, max_write_chunk));
        Ok(Self {
            owner,
            commands,
            wake_stream,
            worker: Some(worker),
            shared,
            next_operation: 1,
            operation_timeout,
            max_pending,
        })
    }

    pub fn metrics(&self) -> HostTransportMetrics {
        self.shared.state.lock().unwrap().metrics
    }

    /// Explicit qualification shutdown.  The historical baseline already
    /// performed Stop + socket wake + worker join from Drop; HTTPS lifecycle
    /// qualification needs the same retirement to become an observable ACK
    /// before the TLS resource owner is considered fully retired.
    pub fn close_backend(&mut self) -> Result<(), HostTransportError> {
        {
            let shared = self.shared.state.lock().unwrap();
            if shared.pending != 0 || !shared.completions.is_empty() {
                return Err(HostTransportError::Busy);
            }
        }
        self.commands
            .send(Command::Stop)
            .map_err(|_| HostTransportError::ExternalFailure)?;
        let _ = self.wake_stream.shutdown(Shutdown::Both);
        if let Some(worker) = self.worker.take() {
            worker
                .join()
                .map_err(|_| HostTransportError::ExternalFailure)?;
        }
        let shared = self.shared.state.lock().unwrap();
        if shared.closed && shared.pending == 0 && shared.completions.is_empty() {
            Ok(())
        } else {
            Err(HostTransportError::ExternalFailure)
        }
    }

    pub fn read(
        &mut self,
        destination: &mut HostWindow,
        length: u32,
    ) -> Result<HostOperation, HostTransportError> {
        let length = length as usize;
        if length == 0 || length > destination.capacity {
            return Err(HostTransportError::Bounds);
        }
        self.issue(PendingKind::Read {
            destination: destination.bytes.clone(),
            capacity: destination.capacity,
            length,
        })
    }

    pub fn write(&mut self, source: &HostWindow) -> Result<HostOperation, HostTransportError> {
        let bytes = source.copy_out();
        if bytes.is_empty() {
            return Err(HostTransportError::Bounds);
        }
        self.issue(PendingKind::Write { bytes })
    }

    pub fn cancel(&mut self, operation: &HostOperation) -> Result<(), HostTransportError> {
        self.validate(operation)?;
        self.commands
            .try_send(Command::Cancel(operation.id))
            .map_err(|_| HostTransportError::Busy)
    }

    pub fn wait(&mut self, selected: &[&HostOperation]) -> Result<Vec<u32>, HostTransportError> {
        if selected.is_empty() {
            return Err(HostTransportError::Bounds);
        }
        for operation in selected {
            self.validate(operation)?;
        }
        let mut shared = self.shared.state.lock().unwrap();
        shared.metrics.waits = shared.metrics.waits.saturating_add(1);
        loop {
            let ready = selected
                .iter()
                .enumerate()
                .filter_map(|(index, operation)| {
                    shared
                        .completions
                        .contains_key(&operation.id)
                        .then_some(index as u32)
                })
                .collect::<Vec<_>>();
            if !ready.is_empty() {
                return Ok(ready);
            }
            if shared.closed {
                return Err(HostTransportError::ExternalFailure);
            }
            shared = self.shared.changed.wait(shared).unwrap();
        }
    }

    pub fn take_result(
        &mut self,
        operation: &mut HostOperation,
    ) -> Result<Terminal, HostTransportError> {
        self.validate(operation)?;
        if operation.claimed {
            return Err(HostTransportError::AlreadyTerminal);
        }
        let mut shared = self.shared.state.lock().unwrap();
        let result = shared
            .completions
            .remove(&operation.id)
            .ok_or(HostTransportError::Busy)?;
        operation.claimed = true;
        shared.metrics.results_claimed = shared.metrics.results_claimed.saturating_add(1);
        result
    }

    fn validate(&self, operation: &HostOperation) -> Result<(), HostTransportError> {
        if operation.owner != self.owner {
            return Err(HostTransportError::InvalidResource);
        }
        Ok(())
    }

    fn issue(&mut self, kind: PendingKind) -> Result<HostOperation, HostTransportError> {
        let id = self.next_operation;
        self.next_operation = self
            .next_operation
            .checked_add(1)
            .ok_or(HostTransportError::Limit)?;
        {
            let mut shared = self.shared.state.lock().unwrap();
            if shared.closed {
                return Err(HostTransportError::InvalidResource);
            }
            if shared.pending >= self.max_pending {
                shared.metrics.backpressure_rejections =
                    shared.metrics.backpressure_rejections.saturating_add(1);
                return Err(HostTransportError::Busy);
            }
            shared.pending += 1;
            shared.metrics.operations_issued = shared.metrics.operations_issued.saturating_add(1);
            shared.metrics.pending_issued = shared.metrics.pending_issued.saturating_add(1);
            shared.metrics.pending_peak = shared.metrics.pending_peak.max(shared.pending as u64);
        }
        let operation = PendingOperation {
            id,
            deadline: Instant::now() + self.operation_timeout,
            kind,
        };
        if self.commands.try_send(Command::Issue(operation)).is_err() {
            let mut shared = self.shared.state.lock().unwrap();
            shared.pending -= 1;
            shared.metrics.backpressure_rejections =
                shared.metrics.backpressure_rejections.saturating_add(1);
            return Err(HostTransportError::Busy);
        }
        Ok(HostOperation {
            id,
            owner: self.owner,
            claimed: false,
        })
    }
}

impl Drop for HostEndpoint {
    fn drop(&mut self) {
        let _ = self.commands.try_send(Command::Stop);
        let _ = self.wake_stream.shutdown(Shutdown::Both);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    fn pair() -> (HostEndpoint, TcpStream) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let peer = TcpStream::connect(addr).unwrap();
        let (stream, _) = listener.accept().unwrap();
        let endpoint =
            HostEndpoint::from_accepted_tcp_with_limits(stream, Duration::from_millis(200), 2, 2)
                .unwrap();
        (endpoint, peer)
    }

    #[test]
    fn resident_pending_owner_covers_claim_cancel_timeout_backpressure_and_partial_write() {
        let (mut endpoint, mut peer) = pair();
        let mut read_window = HostWindow::acquire(8).unwrap();
        let mut cancelled = endpoint.read(&mut read_window, 8).unwrap();
        endpoint.cancel(&cancelled).unwrap();
        assert_eq!(endpoint.wait(&[&cancelled]).unwrap(), [0]);
        assert_eq!(
            endpoint.take_result(&mut cancelled),
            Err(HostTransportError::Cancelled)
        );
        assert_eq!(
            endpoint.take_result(&mut cancelled),
            Err(HostTransportError::AlreadyTerminal)
        );

        let mut pending_a = endpoint.read(&mut read_window, 8).unwrap();
        let mut second_window = HostWindow::acquire(8).unwrap();
        let mut pending_b = endpoint.read(&mut second_window, 8).unwrap();
        let mut third_window = HostWindow::acquire(8).unwrap();
        assert!(matches!(
            endpoint.read(&mut third_window, 8),
            Err(HostTransportError::Busy)
        ));
        peer.write_all(b"abc").unwrap();
        let ready = endpoint.wait(&[&pending_a, &pending_b]).unwrap();
        assert!(!ready.is_empty());
        let selected = ready[0] as usize;
        let (operation, window) = if selected == 0 {
            (&mut pending_a, &read_window)
        } else {
            (&mut pending_b, &second_window)
        };
        assert!(matches!(
            endpoint.take_result(operation),
            Ok(Terminal::Transfer(Transfer { transferred: 3, .. }))
        ));
        assert_eq!(window.copy_out(), b"abc");
        let other = if selected == 0 {
            &pending_b
        } else {
            &pending_a
        };
        endpoint.cancel(other).unwrap();
        endpoint.wait(&[other]).unwrap();

        let mut write_window = HostWindow::acquire(8).unwrap();
        write_window.commit(b"xyz", 3).unwrap();
        let mut write = endpoint.write(&write_window).unwrap();
        endpoint.wait(&[&write]).unwrap();
        assert_eq!(
            endpoint.take_result(&mut write).unwrap(),
            Terminal::Transfer(Transfer {
                transferred: 2,
                eof: false,
                message_complete: false,
            })
        );
        let mut response = [0u8; 2];
        peer.read_exact(&mut response).unwrap();
        assert_eq!(&response, b"xy");

        let mut timeout_window = HostWindow::acquire(8).unwrap();
        let mut timeout = endpoint.read(&mut timeout_window, 8).unwrap();
        endpoint.wait(&[&timeout]).unwrap();
        assert_eq!(
            endpoint.take_result(&mut timeout),
            Err(HostTransportError::Timeout)
        );

        let metrics = endpoint.metrics();
        assert_eq!(metrics.owner_threads_started, 1);
        assert!(metrics.pending_issued >= 5);
        assert!(metrics.pending_peak >= 2);
        assert!(metrics.cancellations >= 2);
        assert!(metrics.timeouts >= 1);
        assert!(metrics.backpressure_rejections >= 1);
        assert!(metrics.partial_writes >= 1);
    }
}
