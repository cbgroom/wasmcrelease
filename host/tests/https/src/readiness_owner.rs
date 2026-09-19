//! Host-private resident readiness owner for physically settled TCP transfers.
//!
//! This is runtime machinery, not a Guest ABI. One worker owns one nonblocking
//! socket and a bounded set of operations. Callers submit effects, wait for a
//! correlated terminal result, and may cancel before settlement. No operation
//! thread is spawned and no effect is replayed after an ambiguous failure.

use std::{
    collections::{BTreeMap, VecDeque},
    fmt,
    net::TcpStream,
    sync::{mpsc, Arc, Condvar, Mutex},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

const SOCKET: mio::Token = mio::Token(0);
const WAKE: mio::Token = mio::Token(1);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoreHostReadyIoError {
    InvalidLimit,
    Capacity,
    Stale,
    Cancelled,
    Timeout,
    External,
    Closed,
}
impl fmt::Display for CoreHostReadyIoError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Core Host readiness: {self:?}")
    }
}
impl std::error::Error for CoreHostReadyIoError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoreHostReadyTransfer {
    pub transferred: u32,
    pub eof: bool,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CoreHostReadyIoMetrics {
    pub submitted: u64,
    pub completed: u64,
    pub cancelled: u64,
    pub timed_out: u64,
    pub capacity_rejected: u64,
    pub poll_calls: u64,
    pub readiness_events: u64,
    pub read_bytes: u64,
    pub write_bytes: u64,
    pub partial_writes: u64,
}

#[derive(Debug)]
enum Effect {
    Read {
        length: usize,
    },
    Write {
        bytes: Arc<Vec<u8>>,
        length: usize,
        offset: usize,
    },
}
#[derive(Debug)]
struct Pending {
    id: u64,
    deadline: Instant,
    cancelled: bool,
    effect: Effect,
}
enum Command {
    Submit(Pending),
    Cancel(u64),
    Stop,
}
struct Shared {
    terminal: BTreeMap<u64, Result<CoreHostReadyTransfer, CoreHostReadyIoError>>,
    metrics: CoreHostReadyIoMetrics,
    closed: bool,
}

pub struct CoreHostTcpReadinessOwner {
    tx: mpsc::SyncSender<Command>,
    wake: Arc<mio::Waker>,
    shared: Arc<(Mutex<Shared>, Condvar)>,
    worker: Option<JoinHandle<()>>,
    next: u64,
    closed: bool,
}

impl CoreHostTcpReadinessOwner {
    pub fn new(stream: TcpStream, maximum: usize) -> Result<Self, CoreHostReadyIoError> {
        if maximum == 0 || maximum > 4096 {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        stream
            .set_nonblocking(true)
            .map_err(|_| CoreHostReadyIoError::External)?;
        let mut socket = mio::net::TcpStream::from_std(stream);
        let poll = mio::Poll::new().map_err(|_| CoreHostReadyIoError::External)?;
        poll.registry()
            .register(&mut socket, SOCKET, mio::Interest::READABLE)
            .map_err(|_| CoreHostReadyIoError::External)?;
        let wake = Arc::new(
            mio::Waker::new(poll.registry(), WAKE).map_err(|_| CoreHostReadyIoError::External)?,
        );
        let (tx, rx) = mpsc::sync_channel(maximum);
        let shared = Arc::new((
            Mutex::new(Shared {
                terminal: BTreeMap::new(),
                metrics: CoreHostReadyIoMetrics::default(),
                closed: false,
            }),
            Condvar::new(),
        ));
        let worker_shared = shared.clone();
        let worker = thread::spawn(move || run_owner(poll, socket, rx, worker_shared, maximum));
        Ok(Self {
            tx,
            wake,
            shared,
            worker: Some(worker),
            next: 1,
            closed: false,
        })
    }
    fn submit(&mut self, effect: Effect, deadline: Instant) -> Result<u64, CoreHostReadyIoError> {
        let id = self.next;
        self.next = self
            .next
            .checked_add(1)
            .ok_or(CoreHostReadyIoError::Capacity)?;
        let pending = Pending {
            id,
            deadline,
            cancelled: false,
            effect,
        };
        self.tx.try_send(Command::Submit(pending)).map_err(|e| {
            let mut s = self.shared.0.lock().unwrap();
            s.metrics.capacity_rejected = s.metrics.capacity_rejected.saturating_add(1);
            match e {
                mpsc::TrySendError::Disconnected(_) => CoreHostReadyIoError::Closed,
                _ => CoreHostReadyIoError::Capacity,
            }
        })?;
        self.wake.wake().map_err(|_| CoreHostReadyIoError::Closed)?;
        Ok(id)
    }
    pub fn read(&mut self, length: u32, deadline: Instant) -> Result<u64, CoreHostReadyIoError> {
        if length == 0 {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        self.submit(
            Effect::Read {
                length: length as usize,
            },
            deadline,
        )
    }
    pub fn write(
        &mut self,
        bytes: Vec<u8>,
        deadline: Instant,
    ) -> Result<u64, CoreHostReadyIoError> {
        if bytes.is_empty() {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        let length = bytes.len();
        self.submit(
            Effect::Write {
                bytes: Arc::from(bytes),
                length,
                offset: 0,
            },
            deadline,
        )
    }
    pub fn write_shared(
        &mut self,
        bytes: Arc<Vec<u8>>,
        length: u32,
        deadline: Instant,
    ) -> Result<u64, CoreHostReadyIoError> {
        let length = length as usize;
        if length == 0 || length > bytes.len() {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        self.submit(
            Effect::Write {
                bytes,
                length,
                offset: 0,
            },
            deadline,
        )
    }
    pub fn cancel(&self, id: u64) -> Result<(), CoreHostReadyIoError> {
        self.tx
            .try_send(Command::Cancel(id))
            .map_err(|_| CoreHostReadyIoError::Capacity)?;
        self.wake.wake().map_err(|_| CoreHostReadyIoError::Closed)
    }
    pub fn wait(&self, id: u64, deadline: Instant) -> Result<(), CoreHostReadyIoError> {
        let (lock, cv) = &*self.shared;
        let mut s = lock.lock().unwrap();
        loop {
            if s.terminal.contains_key(&id) {
                return Ok(());
            }
            if s.closed {
                return Err(CoreHostReadyIoError::Closed);
            }
            let now = Instant::now();
            if now >= deadline {
                return Err(CoreHostReadyIoError::Timeout);
            }
            let (next, _) = cv.wait_timeout(s, deadline - now).unwrap();
            s = next;
        }
    }
    /// Wait until at least one selected operation is terminal and return
    /// selection-relative indexes. Result ownership is unchanged; callers must
    /// still claim each operation exactly once with `take_result`.
    pub fn wait_any(
        &self,
        selected: &[u64],
        deadline: Instant,
    ) -> Result<Vec<u32>, CoreHostReadyIoError> {
        if selected.is_empty() {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        let (lock, cv) = &*self.shared;
        let mut s = lock.lock().unwrap();
        loop {
            let ready = selected
                .iter()
                .enumerate()
                .filter_map(|(index, id)| s.terminal.contains_key(id).then_some(index as u32))
                .collect::<Vec<_>>();
            if !ready.is_empty() {
                return Ok(ready);
            }
            if s.closed {
                return Err(CoreHostReadyIoError::Closed);
            }
            let now = Instant::now();
            if now >= deadline {
                return Err(CoreHostReadyIoError::Timeout);
            }
            let (next, _) = cv.wait_timeout(s, deadline - now).unwrap();
            s = next;
        }
    }

    pub fn try_ready(&self, selected: &[u64]) -> Result<Vec<u32>, CoreHostReadyIoError> {
        if selected.is_empty() {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        let state = self.shared.0.lock().unwrap();
        if state.closed {
            return Err(CoreHostReadyIoError::Closed);
        }
        Ok(selected
            .iter()
            .enumerate()
            .filter_map(|(index, id)| state.terminal.contains_key(id).then_some(index as u32))
            .collect())
    }

    pub fn take_result(&self, id: u64) -> Result<CoreHostReadyTransfer, CoreHostReadyIoError> {
        self.shared
            .0
            .lock()
            .unwrap()
            .terminal
            .remove(&id)
            .ok_or(CoreHostReadyIoError::Stale)?
    }
    pub fn metrics(&self) -> CoreHostReadyIoMetrics {
        self.shared.0.lock().unwrap().metrics
    }
    pub fn close(&mut self) -> Result<(), CoreHostReadyIoError> {
        if self.closed {
            return Ok(());
        }
        self.tx
            .send(Command::Stop)
            .map_err(|_| CoreHostReadyIoError::Closed)?;
        self.wake.wake().map_err(|_| CoreHostReadyIoError::Closed)?;
        if let Some(worker) = self.worker.take() {
            worker.join().map_err(|_| CoreHostReadyIoError::External)?;
        }
        self.closed = true;
        Ok(())
    }
}
impl Drop for CoreHostTcpReadinessOwner {
    fn drop(&mut self) {
        if !self.closed {
            let _ = self.tx.try_send(Command::Stop);
            let _ = self.wake.wake();
            if let Some(worker) = self.worker.take() {
                let _ = worker.join();
            }
            self.closed = true;
        }
    }
}

fn settle(
    shared: &Arc<(Mutex<Shared>, Condvar)>,
    id: u64,
    result: Result<CoreHostReadyTransfer, CoreHostReadyIoError>,
) {
    let (lock, cv) = &**shared;
    let mut s = lock.lock().unwrap();
    if matches!(result, Err(CoreHostReadyIoError::Cancelled)) {
        s.metrics.cancelled = s.metrics.cancelled.saturating_add(1)
    }
    if matches!(result, Err(CoreHostReadyIoError::Timeout)) {
        s.metrics.timed_out = s.metrics.timed_out.saturating_add(1)
    }
    s.metrics.completed = s.metrics.completed.saturating_add(1);
    s.terminal.insert(id, result);
    cv.notify_all();
}

fn run_owner(
    mut poll: mio::Poll,
    mut socket: mio::net::TcpStream,
    rx: mpsc::Receiver<Command>,
    shared: Arc<(Mutex<Shared>, Condvar)>,
    maximum: usize,
) {
    use std::io::{Read, Write};
    let mut pending = VecDeque::<Pending>::new();
    let mut events = mio::Events::with_capacity(16);
    let mut stopping = false;
    let mut registered = true;
    let mut registered_interest = (true, false);
    loop {
        while let Ok(cmd) = rx.try_recv() {
            match cmd {
                Command::Submit(p) => {
                    if pending.len() >= maximum {
                        settle(&shared, p.id, Err(CoreHostReadyIoError::Capacity));
                    } else {
                        shared.0.lock().unwrap().metrics.submitted += 1;
                        pending.push_back(p);
                    }
                }
                Command::Cancel(id) => {
                    if let Some(p) = pending.iter_mut().find(|p| p.id == id) {
                        p.cancelled = true;
                    }
                }
                Command::Stop => stopping = true,
            }
        }
        let now = Instant::now();
        let mut i = 0;
        while i < pending.len() {
            if pending[i].cancelled || now >= pending[i].deadline {
                let p = pending.remove(i).unwrap();
                settle(
                    &shared,
                    p.id,
                    Err(if p.cancelled {
                        CoreHostReadyIoError::Cancelled
                    } else {
                        CoreHostReadyIoError::Timeout
                    }),
                );
            } else {
                i += 1;
            }
        }
        // Level-triggered nonblocking rule: always try to advance pending
        // effects before sleeping. Readiness is only the wake mechanism after
        // WouldBlock; it is never required as permission to attempt I/O.
        let mut i = 0;
        while i < pending.len() {
            let mut done = None;
            let p = &mut pending[i];
            match &mut p.effect {
                Effect::Read { length } => {
                    let mut b = vec![0u8; *length];
                    match socket.read(&mut b) {
                        Ok(n) => {
                            b.truncate(n);
                            let mut s = shared.0.lock().unwrap();
                            s.metrics.read_bytes += n as u64;
                            done = Some(Ok(CoreHostReadyTransfer {
                                transferred: n as u32,
                                eof: n == 0,
                                bytes: b,
                            }));
                        }
                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                        Err(_) => done = Some(Err(CoreHostReadyIoError::External)),
                    }
                }
                Effect::Write {
                    bytes,
                    length,
                    offset,
                } => match socket.write(&bytes[*offset..*length]) {
                    Ok(0) => done = Some(Err(CoreHostReadyIoError::External)),
                    Ok(n) => {
                        *offset += n;
                        let mut s = shared.0.lock().unwrap();
                        s.metrics.write_bytes += n as u64;
                        if *offset < *length {
                            s.metrics.partial_writes += 1
                        } else {
                            done = Some(Ok(CoreHostReadyTransfer {
                                transferred: *offset as u32,
                                eof: false,
                                bytes: Vec::new(),
                            }));
                        }
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                    Err(_) => done = Some(Err(CoreHostReadyIoError::External)),
                },
            }
            if let Some(result) = done {
                let p = pending.remove(i).unwrap();
                settle(&shared, p.id, result)
            } else {
                i += 1
            }
        }
        if stopping && pending.is_empty() {
            break;
        }
        let wants_read = pending
            .iter()
            .any(|pending| matches!(pending.effect, Effect::Read { .. }));
        let wants_write = pending
            .iter()
            .any(|pending| matches!(pending.effect, Effect::Write { .. }));
        if !wants_read && !wants_write {
            if registered {
                if poll.registry().deregister(&mut socket).is_err() {
                    break;
                }
                registered = false;
            }
        } else {
            let interest = match (wants_read, wants_write) {
                (true, true) => mio::Interest::READABLE | mio::Interest::WRITABLE,
                (true, false) => mio::Interest::READABLE,
                (false, true) => mio::Interest::WRITABLE,
                (false, false) => unreachable!(),
            };
            let desired = (wants_read, wants_write);
            let changed = desired != registered_interest;
            let result = if !registered {
                poll.registry().register(&mut socket, SOCKET, interest)
            } else if changed {
                poll.registry().reregister(&mut socket, SOCKET, interest)
            } else {
                Ok(())
            };
            if result.is_err() {
                break;
            }
            registered = true;
            registered_interest = desired;
        }
        let timeout = pending
            .iter()
            .map(|p| p.deadline.saturating_duration_since(Instant::now()))
            .min()
            .unwrap_or(Duration::from_secs(1));
        {
            let mut s = shared.0.lock().unwrap();
            s.metrics.poll_calls = s.metrics.poll_calls.saturating_add(1);
        }
        if poll.poll(&mut events, Some(timeout)).is_err() {
            for p in pending.drain(..) {
                settle(&shared, p.id, Err(CoreHostReadyIoError::External));
            }
            break;
        }
        {
            let mut s = shared.0.lock().unwrap();
            s.metrics.readiness_events = s
                .metrics
                .readiness_events
                .saturating_add(events.iter().count() as u64);
        }
    }
    let (lock, cv) = &*shared;
    let mut s = lock.lock().unwrap();
    s.closed = true;
    cv.notify_all();
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CoreHostSharedReadyMetrics {
    pub worker_threads: u64,
    pub endpoints_attached: u64,
    pub endpoints_closed: u64,
    pub poll_calls: u64,
    pub readiness_events: u64,
}

#[derive(Clone)]
pub struct CoreHostSharedReadyActivity {
    state: Arc<(Mutex<u64>, Condvar)>,
}

impl CoreHostSharedReadyActivity {
    pub fn generation(&self) -> u64 {
        *self.state.0.lock().unwrap()
    }

    pub fn wait_after(
        &self,
        generation: u64,
        deadline: Instant,
    ) -> Result<u64, CoreHostReadyIoError> {
        let (lock, cv) = &*self.state;
        let mut current = lock.lock().unwrap();
        loop {
            if *current != generation {
                return Ok(*current);
            }
            let now = Instant::now();
            if now >= deadline {
                return Err(CoreHostReadyIoError::Timeout);
            }
            let (next, _) = cv.wait_timeout(current, deadline - now).unwrap();
            current = next;
        }
    }

    pub fn signal(&self) {
        let (lock, cv) = &*self.state;
        let mut generation = lock.lock().unwrap();
        *generation = generation.wrapping_add(1);
        cv.notify_all();
    }
}

struct SharedEndpointState {
    terminal: BTreeMap<u64, Result<CoreHostReadyTransfer, CoreHostReadyIoError>>,
    metrics: CoreHostReadyIoMetrics,
    closed: bool,
}

enum SharedCommand {
    Attach {
        endpoint: u64,
        stream: TcpStream,
        maximum: usize,
        state: Arc<(Mutex<SharedEndpointState>, Condvar)>,
        activity: Arc<(Mutex<u64>, Condvar)>,
        reply: mpsc::SyncSender<Result<(), CoreHostReadyIoError>>,
    },
    Submit {
        endpoint: u64,
        pending: Pending,
    },
    Cancel {
        endpoint: u64,
        operation: u64,
    },
    Detach {
        endpoint: u64,
        reply: mpsc::SyncSender<()>,
    },
    Stop,
}

struct SharedWorkerEndpoint {
    socket: mio::net::TcpStream,
    token: mio::Token,
    maximum: usize,
    pending: VecDeque<Pending>,
    state: Arc<(Mutex<SharedEndpointState>, Condvar)>,
    activity: Arc<(Mutex<u64>, Condvar)>,
    registered: bool,
    registered_interest: (bool, bool),
}

#[derive(Default)]
struct SharedActivityBatch {
    pending: Vec<Arc<(Mutex<u64>, Condvar)>>,
}

impl SharedActivityBatch {
    fn queue(&mut self, activity: &Arc<(Mutex<u64>, Condvar)>) {
        if !self
            .pending
            .iter()
            .any(|pending| Arc::ptr_eq(pending, activity))
        {
            self.pending.push(activity.clone());
        }
    }

    fn settle(
        &mut self,
        endpoint: &SharedWorkerEndpoint,
        id: u64,
        result: Result<CoreHostReadyTransfer, CoreHostReadyIoError>,
    ) {
        shared_publish_terminal(endpoint, id, result);
        self.queue(&endpoint.activity);
    }

    fn flush(&mut self) {
        for activity in self.pending.drain(..) {
            shared_signal_activity(&activity);
        }
    }
}

struct SharedReactorState {
    metrics: CoreHostSharedReadyMetrics,
    closed: bool,
}

struct SharedCommandQueue {
    pending: VecDeque<SharedCommand>,
    outstanding: usize,
    capacity: usize,
    wake_armed: bool,
    closed: bool,
}

struct SharedReactorInner {
    commands: Mutex<SharedCommandQueue>,
    command_capacity: Condvar,
    wake: Arc<mio::Waker>,
    state: Arc<Mutex<SharedReactorState>>,
    activity: Arc<(Mutex<u64>, Condvar)>,
}

impl SharedReactorInner {
    fn try_enqueue(&self, command: SharedCommand) -> Result<(), CoreHostReadyIoError> {
        let should_wake = {
            let mut queue = self.commands.lock().unwrap();
            if queue.closed {
                return Err(CoreHostReadyIoError::Closed);
            }
            if queue.outstanding >= queue.capacity {
                return Err(CoreHostReadyIoError::Capacity);
            }
            queue.pending.push_back(command);
            queue.outstanding += 1;
            if queue.wake_armed {
                false
            } else {
                queue.wake_armed = true;
                true
            }
        };
        if should_wake {
            self.wake.wake().map_err(|_| CoreHostReadyIoError::Closed)?;
        }
        Ok(())
    }

    fn enqueue_blocking(&self, command: SharedCommand) -> Result<(), CoreHostReadyIoError> {
        let should_wake = {
            let mut queue = self.commands.lock().unwrap();
            while !queue.closed && queue.outstanding >= queue.capacity {
                queue = self.command_capacity.wait(queue).unwrap();
            }
            if queue.closed {
                return Err(CoreHostReadyIoError::Closed);
            }
            queue.pending.push_back(command);
            queue.outstanding += 1;
            if queue.wake_armed {
                false
            } else {
                queue.wake_armed = true;
                true
            }
        };
        if should_wake {
            self.wake.wake().map_err(|_| CoreHostReadyIoError::Closed)?;
        }
        Ok(())
    }

    fn take_command_batch(&self, batch: &mut VecDeque<SharedCommand>) -> usize {
        debug_assert!(batch.is_empty());
        let mut queue = self.commands.lock().unwrap();
        batch.append(&mut queue.pending);
        queue.wake_armed = false;
        batch.len()
    }

    fn finish_command_batch(&self, count: usize) {
        if count == 0 {
            return;
        }
        let mut queue = self.commands.lock().unwrap();
        debug_assert!(queue.outstanding >= count);
        queue.outstanding -= count;
        self.command_capacity.notify_all();
    }

    fn close_command_queue(&self) {
        let mut queue = self.commands.lock().unwrap();
        queue.closed = true;
        self.command_capacity.notify_all();
    }
}

pub struct CoreHostSharedTcpReadinessReactor {
    inner: Arc<SharedReactorInner>,
    worker: Option<JoinHandle<()>>,
    next_endpoint: u64,
}

pub struct CoreHostSharedTcpEndpoint {
    endpoint: u64,
    inner: Arc<SharedReactorInner>,
    state: Arc<(Mutex<SharedEndpointState>, Condvar)>,
    next: u64,
    maximum: usize,
    closed: bool,
}

impl CoreHostSharedTcpReadinessReactor {
    pub fn new(command_capacity: usize) -> Result<Self, CoreHostReadyIoError> {
        if command_capacity == 0 || command_capacity > 65536 {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        let poll = mio::Poll::new().map_err(|_| CoreHostReadyIoError::External)?;
        let wake = Arc::new(
            mio::Waker::new(poll.registry(), WAKE).map_err(|_| CoreHostReadyIoError::External)?,
        );
        let state = Arc::new(Mutex::new(SharedReactorState {
            metrics: CoreHostSharedReadyMetrics {
                worker_threads: 1,
                ..CoreHostSharedReadyMetrics::default()
            },
            closed: false,
        }));
        let activity = Arc::new((Mutex::new(0u64), Condvar::new()));
        let inner = Arc::new(SharedReactorInner {
            commands: Mutex::new(SharedCommandQueue {
                pending: VecDeque::new(),
                outstanding: 0,
                capacity: command_capacity,
                wake_armed: false,
                closed: false,
            }),
            command_capacity: Condvar::new(),
            wake,
            state,
            activity,
        });
        let worker_inner = inner.clone();
        let worker = thread::spawn(move || run_shared_reactor(poll, worker_inner));
        Ok(Self {
            inner,
            worker: Some(worker),
            next_endpoint: 1,
        })
    }

    pub fn attach(
        &mut self,
        stream: TcpStream,
        maximum: usize,
    ) -> Result<CoreHostSharedTcpEndpoint, CoreHostReadyIoError> {
        let activity = self.activity();
        self.attach_with_activity(stream, maximum, &activity)
    }

    pub fn new_activity(&self) -> CoreHostSharedReadyActivity {
        CoreHostSharedReadyActivity {
            state: Arc::new((Mutex::new(0u64), Condvar::new())),
        }
    }

    pub fn attach_with_activity(
        &mut self,
        stream: TcpStream,
        maximum: usize,
        activity: &CoreHostSharedReadyActivity,
    ) -> Result<CoreHostSharedTcpEndpoint, CoreHostReadyIoError> {
        if maximum == 0 || maximum > 4096 {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        stream
            .set_nonblocking(true)
            .map_err(|_| CoreHostReadyIoError::External)?;
        let endpoint = self.next_endpoint;
        self.next_endpoint = self
            .next_endpoint
            .checked_add(1)
            .ok_or(CoreHostReadyIoError::Capacity)?;
        if usize::try_from(endpoint)
            .ok()
            .and_then(|v| v.checked_add(2))
            .is_none()
        {
            return Err(CoreHostReadyIoError::Capacity);
        }
        let state = Arc::new((
            Mutex::new(SharedEndpointState {
                terminal: BTreeMap::new(),
                metrics: CoreHostReadyIoMetrics::default(),
                closed: false,
            }),
            Condvar::new(),
        ));
        let (reply, ack) = mpsc::sync_channel(1);
        self.inner.try_enqueue(SharedCommand::Attach {
            endpoint,
            stream,
            maximum,
            state: state.clone(),
            activity: activity.state.clone(),
            reply,
        })?;
        ack.recv().map_err(|_| CoreHostReadyIoError::Closed)??;
        Ok(CoreHostSharedTcpEndpoint {
            endpoint,
            inner: self.inner.clone(),
            state,
            next: 1,
            maximum,
            closed: false,
        })
    }

    pub fn metrics(&self) -> CoreHostSharedReadyMetrics {
        self.inner.state.lock().unwrap().metrics
    }

    pub fn activity(&self) -> CoreHostSharedReadyActivity {
        CoreHostSharedReadyActivity {
            state: self.inner.activity.clone(),
        }
    }
}

impl Drop for CoreHostSharedTcpReadinessReactor {
    fn drop(&mut self) {
        let _ = self.inner.enqueue_blocking(SharedCommand::Stop);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

impl CoreHostSharedTcpEndpoint {
    fn submit(&mut self, effect: Effect, deadline: Instant) -> Result<u64, CoreHostReadyIoError> {
        if self.closed {
            return Err(CoreHostReadyIoError::Closed);
        }
        let pending_now = {
            let state = self.state.0.lock().unwrap();
            state
                .metrics
                .submitted
                .saturating_sub(state.metrics.completed) as usize
        };
        if pending_now >= self.maximum {
            let mut state = self.state.0.lock().unwrap();
            state.metrics.capacity_rejected = state.metrics.capacity_rejected.saturating_add(1);
            return Err(CoreHostReadyIoError::Capacity);
        }
        let id = self.next;
        self.next = self
            .next
            .checked_add(1)
            .ok_or(CoreHostReadyIoError::Capacity)?;
        self.inner.try_enqueue(SharedCommand::Submit {
            endpoint: self.endpoint,
            pending: Pending {
                id,
                deadline,
                cancelled: false,
                effect,
            },
        })?;
        Ok(id)
    }

    pub fn read(&mut self, length: u32, deadline: Instant) -> Result<u64, CoreHostReadyIoError> {
        if length == 0 {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        self.submit(
            Effect::Read {
                length: length as usize,
            },
            deadline,
        )
    }

    pub fn write(
        &mut self,
        bytes: Vec<u8>,
        deadline: Instant,
    ) -> Result<u64, CoreHostReadyIoError> {
        if bytes.is_empty() {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        let length = bytes.len();
        self.submit(
            Effect::Write {
                bytes: Arc::from(bytes),
                length,
                offset: 0,
            },
            deadline,
        )
    }

    pub fn write_shared(
        &mut self,
        bytes: Arc<Vec<u8>>,
        length: u32,
        deadline: Instant,
    ) -> Result<u64, CoreHostReadyIoError> {
        let length = length as usize;
        if length == 0 || length > bytes.len() {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        self.submit(
            Effect::Write {
                bytes,
                length,
                offset: 0,
            },
            deadline,
        )
    }

    pub fn cancel(&self, operation: u64) -> Result<(), CoreHostReadyIoError> {
        self.inner.try_enqueue(SharedCommand::Cancel {
            endpoint: self.endpoint,
            operation,
        })
    }

    pub fn wait_any(
        &self,
        selected: &[u64],
        deadline: Instant,
    ) -> Result<Vec<u32>, CoreHostReadyIoError> {
        if selected.is_empty() {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        let (lock, cv) = &*self.state;
        let mut state = lock.lock().unwrap();
        loop {
            let ready = selected
                .iter()
                .enumerate()
                .filter_map(|(index, id)| state.terminal.contains_key(id).then_some(index as u32))
                .collect::<Vec<_>>();
            if !ready.is_empty() {
                return Ok(ready);
            }
            if state.closed {
                return Err(CoreHostReadyIoError::Closed);
            }
            let now = Instant::now();
            if now >= deadline {
                return Err(CoreHostReadyIoError::Timeout);
            }
            let (next, _) = cv.wait_timeout(state, deadline - now).unwrap();
            state = next;
        }
    }

    pub fn try_ready(&self, selected: &[u64]) -> Result<Vec<u32>, CoreHostReadyIoError> {
        if selected.is_empty() {
            return Err(CoreHostReadyIoError::InvalidLimit);
        }
        let state = self.state.0.lock().unwrap();
        if state.closed {
            return Err(CoreHostReadyIoError::Closed);
        }
        Ok(selected
            .iter()
            .enumerate()
            .filter_map(|(index, id)| state.terminal.contains_key(id).then_some(index as u32))
            .collect())
    }

    pub fn take_result(
        &self,
        operation: u64,
    ) -> Result<CoreHostReadyTransfer, CoreHostReadyIoError> {
        self.state
            .0
            .lock()
            .unwrap()
            .terminal
            .remove(&operation)
            .ok_or(CoreHostReadyIoError::Stale)?
    }

    pub fn metrics(&self) -> CoreHostReadyIoMetrics {
        self.state.0.lock().unwrap().metrics
    }

    pub fn close(&mut self) -> Result<(), CoreHostReadyIoError> {
        if self.closed {
            return Ok(());
        }
        let (reply, ack) = mpsc::sync_channel(1);
        self.inner.enqueue_blocking(SharedCommand::Detach {
            endpoint: self.endpoint,
            reply,
        })?;
        ack.recv().map_err(|_| CoreHostReadyIoError::Closed)?;
        self.closed = true;
        Ok(())
    }
}

impl Drop for CoreHostSharedTcpEndpoint {
    fn drop(&mut self) {
        if !self.closed {
            let (reply, _) = mpsc::sync_channel(1);
            let _ = self.inner.try_enqueue(SharedCommand::Detach {
                endpoint: self.endpoint,
                reply,
            });
        }
    }
}

fn shared_publish_terminal(
    endpoint: &SharedWorkerEndpoint,
    id: u64,
    result: Result<CoreHostReadyTransfer, CoreHostReadyIoError>,
) {
    let (lock, cv) = &*endpoint.state;
    let mut state = lock.lock().unwrap();
    if matches!(result, Err(CoreHostReadyIoError::Cancelled)) {
        state.metrics.cancelled = state.metrics.cancelled.saturating_add(1);
    }
    if matches!(result, Err(CoreHostReadyIoError::Timeout)) {
        state.metrics.timed_out = state.metrics.timed_out.saturating_add(1);
    }
    state.metrics.completed = state.metrics.completed.saturating_add(1);
    state.terminal.insert(id, result);
    cv.notify_all();
}

fn shared_signal_activity(activity: &Arc<(Mutex<u64>, Condvar)>) {
    let (lock, cv) = &**activity;
    let mut generation = lock.lock().unwrap();
    *generation = generation.wrapping_add(1);
    cv.notify_all();
}

fn shared_settle(
    endpoint: &SharedWorkerEndpoint,
    id: u64,
    result: Result<CoreHostReadyTransfer, CoreHostReadyIoError>,
) {
    shared_publish_terminal(endpoint, id, result);
    shared_signal_activity(&endpoint.activity);
}

fn shared_update_interest(
    poll: &mio::Poll,
    endpoint: &mut SharedWorkerEndpoint,
) -> Result<(), CoreHostReadyIoError> {
    let wants_read = endpoint
        .pending
        .iter()
        .any(|p| matches!(p.effect, Effect::Read { .. }));
    let wants_write = endpoint
        .pending
        .iter()
        .any(|p| matches!(p.effect, Effect::Write { .. }));
    if !wants_read && !wants_write {
        if endpoint.registered {
            poll.registry()
                .deregister(&mut endpoint.socket)
                .map_err(|_| CoreHostReadyIoError::External)?;
            endpoint.registered = false;
        }
        return Ok(());
    }
    let interest = match (wants_read, wants_write) {
        (true, true) => mio::Interest::READABLE | mio::Interest::WRITABLE,
        (true, false) => mio::Interest::READABLE,
        (false, true) => mio::Interest::WRITABLE,
        (false, false) => unreachable!(),
    };
    let desired = (wants_read, wants_write);
    if !endpoint.registered {
        poll.registry()
            .register(&mut endpoint.socket, endpoint.token, interest)
            .map_err(|_| CoreHostReadyIoError::External)?;
        endpoint.registered = true;
        endpoint.registered_interest = desired;
    } else if endpoint.registered_interest != desired {
        poll.registry()
            .reregister(&mut endpoint.socket, endpoint.token, interest)
            .map_err(|_| CoreHostReadyIoError::External)?;
        endpoint.registered_interest = desired;
    }
    Ok(())
}

fn shared_progress(
    endpoint: &mut SharedWorkerEndpoint,
    now: Instant,
    activity_batch: &mut SharedActivityBatch,
) {
    use std::io::{Read, Write};
    let mut i = 0;
    while i < endpoint.pending.len() {
        if endpoint.pending[i].cancelled || now >= endpoint.pending[i].deadline {
            let pending = endpoint.pending.remove(i).unwrap();
            activity_batch.settle(
                endpoint,
                pending.id,
                Err(if pending.cancelled {
                    CoreHostReadyIoError::Cancelled
                } else {
                    CoreHostReadyIoError::Timeout
                }),
            );
            continue;
        }
        let mut done = None;
        let pending = &mut endpoint.pending[i];
        match &mut pending.effect {
            Effect::Read { length } => {
                let mut bytes = vec![0u8; *length];
                match endpoint.socket.read(&mut bytes) {
                    Ok(n) => {
                        bytes.truncate(n);
                        endpoint.state.0.lock().unwrap().metrics.read_bytes += n as u64;
                        done = Some(Ok(CoreHostReadyTransfer {
                            transferred: n as u32,
                            eof: n == 0,
                            bytes,
                        }));
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {}
                    Err(_) => done = Some(Err(CoreHostReadyIoError::External)),
                }
            }
            Effect::Write {
                bytes,
                length,
                offset,
            } => match endpoint.socket.write(&bytes[*offset..*length]) {
                Ok(0) => done = Some(Err(CoreHostReadyIoError::External)),
                Ok(n) => {
                    *offset += n;
                    let mut state = endpoint.state.0.lock().unwrap();
                    state.metrics.write_bytes += n as u64;
                    if *offset < *length {
                        state.metrics.partial_writes += 1;
                    } else {
                        done = Some(Ok(CoreHostReadyTransfer {
                            transferred: *offset as u32,
                            eof: false,
                            bytes: Vec::new(),
                        }));
                    }
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {}
                Err(_) => done = Some(Err(CoreHostReadyIoError::External)),
            },
        }
        if let Some(result) = done {
            let pending = endpoint.pending.remove(i).unwrap();
            activity_batch.settle(endpoint, pending.id, result);
        } else {
            i += 1;
        }
    }
}

fn run_shared_reactor(mut poll: mio::Poll, inner: Arc<SharedReactorInner>) {
    let mut endpoints = BTreeMap::<u64, SharedWorkerEndpoint>::new();
    let mut events = mio::Events::with_capacity(256);
    let mut commands = VecDeque::<SharedCommand>::new();
    let mut activity_batch = SharedActivityBatch::default();
    let mut stopping = false;
    loop {
        let command_count = inner.take_command_batch(&mut commands);
        while let Some(command) = commands.pop_front() {
            match command {
                SharedCommand::Attach {
                    endpoint,
                    stream,
                    maximum,
                    state,
                    activity,
                    reply,
                } => {
                    let token = match usize::try_from(endpoint)
                        .ok()
                        .and_then(|v| v.checked_add(2))
                    {
                        Some(token) => mio::Token(token),
                        None => {
                            let _ = reply.send(Err(CoreHostReadyIoError::Capacity));
                            continue;
                        }
                    };
                    let socket = mio::net::TcpStream::from_std(stream);
                    endpoints.insert(
                        endpoint,
                        SharedWorkerEndpoint {
                            socket,
                            token,
                            maximum,
                            pending: VecDeque::new(),
                            state,
                            activity,
                            registered: false,
                            registered_interest: (false, false),
                        },
                    );
                    inner.state.lock().unwrap().metrics.endpoints_attached += 1;
                    let _ = reply.send(Ok(()));
                }
                SharedCommand::Submit { endpoint, pending } => {
                    if let Some(owner) = endpoints.get_mut(&endpoint) {
                        if owner.pending.len() >= owner.maximum {
                            owner.state.0.lock().unwrap().metrics.capacity_rejected += 1;
                            shared_settle(owner, pending.id, Err(CoreHostReadyIoError::Capacity));
                        } else {
                            owner.state.0.lock().unwrap().metrics.submitted += 1;
                            owner.pending.push_back(pending);
                        }
                    }
                }
                SharedCommand::Cancel {
                    endpoint,
                    operation,
                } => {
                    if let Some(owner) = endpoints.get_mut(&endpoint) {
                        if let Some(pending) = owner.pending.iter_mut().find(|p| p.id == operation)
                        {
                            pending.cancelled = true;
                        }
                    }
                }
                SharedCommand::Detach { endpoint, reply } => {
                    if let Some(mut owner) = endpoints.remove(&endpoint) {
                        if owner.registered {
                            let _ = poll.registry().deregister(&mut owner.socket);
                        }
                        let cancelled = owner
                            .pending
                            .drain(..)
                            .map(|pending| pending.id)
                            .collect::<Vec<_>>();
                        for id in cancelled {
                            shared_settle(&owner, id, Err(CoreHostReadyIoError::Cancelled));
                        }
                        let (lock, cv) = &*owner.state;
                        lock.lock().unwrap().closed = true;
                        cv.notify_all();
                        inner.state.lock().unwrap().metrics.endpoints_closed += 1;
                    }
                    let _ = reply.send(());
                }
                SharedCommand::Stop => stopping = true,
            }
        }
        inner.finish_command_batch(command_count);
        let now = Instant::now();
        for endpoint in endpoints.values_mut() {
            shared_progress(endpoint, now, &mut activity_batch);
            if shared_update_interest(&poll, endpoint).is_err() {
                let (lock, cv) = &*endpoint.state;
                lock.lock().unwrap().closed = true;
                cv.notify_all();
            }
        }
        activity_batch.flush();
        if stopping {
            break;
        }
        let timeout = endpoints
            .values()
            .flat_map(|endpoint| endpoint.pending.iter())
            .map(|pending| pending.deadline.saturating_duration_since(Instant::now()))
            .min()
            .unwrap_or(Duration::from_secs(1));
        inner.state.lock().unwrap().metrics.poll_calls += 1;
        if poll.poll(&mut events, Some(timeout)).is_err() {
            break;
        }
        inner.state.lock().unwrap().metrics.readiness_events += events.iter().count() as u64;
    }
    for (_, mut endpoint) in endpoints {
        if endpoint.registered {
            let _ = poll.registry().deregister(&mut endpoint.socket);
        }
        let cancelled = endpoint
            .pending
            .drain(..)
            .map(|pending| pending.id)
            .collect::<Vec<_>>();
        for id in cancelled {
            shared_settle(&endpoint, id, Err(CoreHostReadyIoError::Cancelled));
        }
        let (lock, cv) = &*endpoint.state;
        lock.lock().unwrap().closed = true;
        cv.notify_all();
    }
    inner.state.lock().unwrap().closed = true;
    inner.close_command_queue();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
    };
    #[test]
    fn resident_owner_read_write_cancel_and_timeout() {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let a = l.local_addr().unwrap();
        let (release, hold) = mpsc::channel();
        let peer = thread::spawn(move || {
            let mut s = TcpStream::connect(a).unwrap();
            s.write_all(b"abc").unwrap();
            let mut b = [0; 3];
            s.read_exact(&mut b).unwrap();
            assert_eq!(&b, b"xyz");
            hold.recv().unwrap();
        });
        let (s, _) = l.accept().unwrap();
        let mut o = CoreHostTcpReadinessOwner::new(s, 8).unwrap();
        let d = Instant::now() + Duration::from_secs(2);
        let r = o.read(8, d).unwrap();
        o.wait(r, d).unwrap();
        let x = o.take_result(r).unwrap();
        assert_eq!(x.bytes, b"abc");
        let w = o.write(b"xyz".to_vec(), d).unwrap();
        assert_eq!(o.wait_any(&[w], d).unwrap(), [0]);
        assert_eq!(o.take_result(w).unwrap().transferred, 3);
        let t = o
            .read(1, Instant::now() + Duration::from_millis(10))
            .unwrap();
        o.wait(t, Instant::now() + Duration::from_secs(1)).unwrap();
        assert_eq!(o.take_result(t), Err(CoreHostReadyIoError::Timeout));
        let c = o.read(1, Instant::now() + Duration::from_secs(2)).unwrap();
        o.cancel(c).unwrap();
        o.wait(c, Instant::now() + Duration::from_secs(1)).unwrap();
        assert_eq!(o.take_result(c), Err(CoreHostReadyIoError::Cancelled));
        release.send(()).unwrap();
        peer.join().unwrap();
        let eof = o.read(1, Instant::now() + Duration::from_secs(2)).unwrap();
        o.wait(eof, Instant::now() + Duration::from_secs(1))
            .unwrap();
        let eof = o.take_result(eof).unwrap();
        assert!(eof.eof);
        let metrics = o.metrics();
        assert_eq!(metrics.cancelled, 1);
        assert_eq!(metrics.timed_out, 1);
    }

    #[test]
    fn wait_any_returns_selection_relative_index_without_claiming() {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let a = l.local_addr().unwrap();
        let mut peer = TcpStream::connect(a).unwrap();
        let (s, _) = l.accept().unwrap();
        let mut o = CoreHostTcpReadinessOwner::new(s, 4).unwrap();
        let d = Instant::now() + Duration::from_secs(2);
        let first = o.read(1, d).unwrap();
        let second = o.read(1, d).unwrap();
        o.cancel(second).unwrap();
        assert_eq!(o.wait_any(&[first, second], d).unwrap(), [1]);
        assert_eq!(o.take_result(second), Err(CoreHostReadyIoError::Cancelled));
        peer.write_all(b"x").unwrap();
        assert_eq!(o.wait_any(&[first], d).unwrap(), [0]);
        assert_eq!(o.take_result(first).unwrap().bytes, b"x");
    }

    #[test]
    fn shared_reactor_isolates_eight_real_tcp_endpoints_on_one_worker() {
        let mut reactor = CoreHostSharedTcpReadinessReactor::new(256).unwrap();
        let mut endpoints = Vec::new();
        let mut peers = Vec::new();
        for _ in 0..8u8 {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let peer = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
            let (stream, _) = listener.accept().unwrap();
            endpoints.push(reactor.attach(stream, 8).unwrap());
            peers.push(peer);
        }
        let deadline = Instant::now() + Duration::from_secs(2);
        let mut reads = Vec::new();
        for endpoint in &mut endpoints {
            reads.push(endpoint.read(1, deadline).unwrap());
        }
        for (index, peer) in peers.iter_mut().enumerate() {
            peer.write_all(&[index as u8]).unwrap();
        }
        for (index, endpoint) in endpoints.iter().enumerate() {
            assert_eq!(endpoint.wait_any(&[reads[index]], deadline).unwrap(), [0]);
            assert_eq!(
                endpoint.take_result(reads[index]).unwrap().bytes,
                [index as u8]
            );
        }
        let mut writes = Vec::new();
        for (index, endpoint) in endpoints.iter_mut().enumerate() {
            writes.push(endpoint.write(vec![0x80 + index as u8], deadline).unwrap());
        }
        for (index, endpoint) in endpoints.iter().enumerate() {
            assert_eq!(endpoint.wait_any(&[writes[index]], deadline).unwrap(), [0]);
            assert_eq!(endpoint.take_result(writes[index]).unwrap().transferred, 1);
        }
        for (index, peer) in peers.iter_mut().enumerate() {
            let mut byte = [0u8; 1];
            peer.read_exact(&mut byte).unwrap();
            assert_eq!(byte, [0x80 + index as u8]);
        }
        for endpoint in &mut endpoints {
            endpoint.close().unwrap();
        }
        let metrics = reactor.metrics();
        assert_eq!(metrics.worker_threads, 1);
        assert_eq!(metrics.endpoints_attached, 8);
        assert_eq!(metrics.endpoints_closed, 8);
        for endpoint in &endpoints {
            let metrics = endpoint.metrics();
            assert_eq!(metrics.submitted, 2);
            assert_eq!(metrics.completed, 2);
            assert_eq!(metrics.read_bytes, 1);
            assert_eq!(metrics.write_bytes, 1);
        }
    }

    #[test]
    fn shared_activity_wakes_worker_without_endpoint_polling() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let mut peer = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (stream, _) = listener.accept().unwrap();
        let mut reactor = CoreHostSharedTcpReadinessReactor::new(32).unwrap();
        let activity = reactor.activity();
        let mut endpoint = reactor.attach(stream, 8).unwrap();
        let generation = activity.generation();
        let deadline = Instant::now() + Duration::from_secs(2);
        let read = endpoint.read(1, deadline).unwrap();
        assert!(endpoint.try_ready(&[read]).unwrap().is_empty());
        peer.write_all(b"q").unwrap();
        let next = activity.wait_after(generation, deadline).unwrap();
        assert_ne!(next, generation);
        assert_eq!(endpoint.try_ready(&[read]).unwrap(), [0]);
        assert_eq!(endpoint.take_result(read).unwrap().bytes, b"q");
        endpoint.close().unwrap();
    }

    #[test]
    fn shared_activity_explicit_signal_wakes_admission_waiter() {
        let reactor = CoreHostSharedTcpReadinessReactor::new(8).unwrap();
        let activity = reactor.new_activity();
        let generation = activity.generation();
        activity.signal();
        let next = activity
            .wait_after(generation, Instant::now() + Duration::from_millis(50))
            .unwrap();
        assert_ne!(next, generation);
    }

    #[test]
    fn shared_activity_batch_coalesces_duplicate_activity() {
        let first = Arc::new((Mutex::new(7u64), Condvar::new()));
        let second = Arc::new((Mutex::new(19u64), Condvar::new()));
        let mut batch = SharedActivityBatch::default();
        batch.queue(&first);
        batch.queue(&first);
        batch.queue(&second);
        assert_eq!(batch.pending.len(), 2);
        batch.flush();
        assert_eq!(*first.0.lock().unwrap(), 8);
        assert_eq!(*second.0.lock().unwrap(), 20);
        assert!(batch.pending.is_empty());
    }
}
