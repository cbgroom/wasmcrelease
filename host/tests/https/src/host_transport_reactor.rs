use crate::readiness_owner::{
    CoreHostReadyIoError, CoreHostSharedTcpEndpoint, CoreHostSharedTcpReadinessReactor,
    CoreHostTcpReadinessOwner, CoreHostWorkerPlacement,
};
use std::{
    collections::BTreeMap,
    error::Error,
    fmt,
    net::TcpStream,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};

const DEFAULT_MAX_PENDING: usize = 64;
const SHARED_REACTOR_COMMAND_CAPACITY: usize = 4096;
const DEFAULT_REACTOR_SHARDS: usize = 1;
const MAX_REACTOR_SHARDS: usize = 64;
static NEXT_REACTOR_SHARD: AtomicU64 = AtomicU64::new(0);

fn reactor_affinity_enabled() -> bool {
    matches!(
        std::env::var("WASMC_HOST_REACTOR_AFFINITY").as_deref(),
        Ok("1") | Ok("true") | Ok("on")
    )
}

fn configured_reactor_shards() -> Result<usize, CoreHostReadyIoError> {
    let shards = std::env::var("WASMC_HOST_REACTOR_SHARDS")
        .ok()
        .map(|value| value.parse::<usize>())
        .transpose()
        .map_err(|_| CoreHostReadyIoError::InvalidLimit)?
        .unwrap_or(DEFAULT_REACTOR_SHARDS);
    if shards == 0 || shards > MAX_REACTOR_SHARDS {
        return Err(CoreHostReadyIoError::InvalidLimit);
    }
    Ok(shards)
}

fn shared_reactors(
) -> Result<&'static [Mutex<CoreHostSharedTcpReadinessReactor>], HostTransportError> {
    static REACTORS: OnceLock<
        Result<Vec<Mutex<CoreHostSharedTcpReadinessReactor>>, CoreHostReadyIoError>,
    > = OnceLock::new();
    match REACTORS.get_or_init(|| {
        let shards = configured_reactor_shards()?;
        (0..shards)
            .map(|shard| {
                let placement =
                    reactor_affinity_enabled().then(|| CoreHostWorkerPlacement::stable(shard));
                CoreHostSharedTcpReadinessReactor::new_with_placement(
                    SHARED_REACTOR_COMMAND_CAPACITY,
                    placement,
                )
                .map(Mutex::new)
            })
            .collect()
    }) {
        Ok(reactors) => Ok(reactors.as_slice()),
        Err(error) => Err(map_ready_error(*error)),
    }
}

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
    bytes: Arc<Mutex<Arc<Vec<u8>>>>,
    capacity: usize,
}

impl HostWindow {
    pub fn acquire(capacity: u32) -> Result<Self, HostTransportError> {
        let capacity = capacity as usize;
        if capacity == 0 {
            return Err(HostTransportError::Bounds);
        }
        Ok(Self {
            bytes: Arc::new(Mutex::new(Arc::new(Vec::new()))),
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
        *self.bytes.lock().unwrap() = Arc::new(initialized[..valid].to_vec());
        Ok(())
    }

    pub fn from_owned(initialized: Vec<u8>) -> Result<Self, HostTransportError> {
        if initialized.is_empty() {
            return Err(HostTransportError::Bounds);
        }
        let capacity = initialized.len();
        Ok(Self {
            bytes: Arc::new(Mutex::new(Arc::new(initialized))),
            capacity,
        })
    }

    pub fn copy_out(&self) -> Vec<u8> {
        self.bytes.lock().unwrap().as_ref().clone()
    }

    fn shared_prefix(&self, limit: usize) -> (Arc<Vec<u8>>, usize, usize) {
        let bytes = self.bytes.lock().unwrap();
        let requested = bytes.len();
        let physical = requested.min(limit);
        (bytes.clone(), requested, physical)
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
    pub placement_requested: u64,
    pub placement_applied: u64,
}

static NEXT_READY_ENDPOINT: AtomicU64 = AtomicU64::new(1);

enum ReadyContext {
    Read {
        destination: Arc<Mutex<Arc<Vec<u8>>>>,
        capacity: usize,
    },
    Write {
        requested: usize,
    },
}

enum ReadyIssue {
    Read(u32),
    WriteShared { bytes: Arc<Vec<u8>>, length: u32 },
}

enum ReadyBackend {
    Dedicated(CoreHostTcpReadinessOwner),
    Shared(CoreHostSharedTcpEndpoint),
}

impl ReadyBackend {
    fn metrics(&self) -> crate::readiness_owner::CoreHostReadyIoMetrics {
        match self {
            Self::Dedicated(ready) => ready.metrics(),
            Self::Shared(ready) => ready.metrics(),
        }
    }
    fn read(&mut self, length: u32, deadline: Instant) -> Result<u64, CoreHostReadyIoError> {
        match self {
            Self::Dedicated(ready) => ready.read(length, deadline),
            Self::Shared(ready) => ready.read(length, deadline),
        }
    }
    fn write_shared(
        &mut self,
        bytes: Arc<Vec<u8>>,
        length: u32,
        deadline: Instant,
    ) -> Result<u64, CoreHostReadyIoError> {
        match self {
            Self::Dedicated(ready) => ready.write_shared(bytes, length, deadline),
            Self::Shared(ready) => ready.write_shared(bytes, length, deadline),
        }
    }
    fn cancel(&self, id: u64) -> Result<(), CoreHostReadyIoError> {
        match self {
            Self::Dedicated(ready) => ready.cancel(id),
            Self::Shared(ready) => ready.cancel(id),
        }
    }
    fn wait_any(&self, ids: &[u64], deadline: Instant) -> Result<Vec<u32>, CoreHostReadyIoError> {
        match self {
            Self::Dedicated(ready) => ready.wait_any(ids, deadline),
            Self::Shared(ready) => ready.wait_any(ids, deadline),
        }
    }
    fn try_ready(&self, ids: &[u64]) -> Result<Vec<u32>, CoreHostReadyIoError> {
        match self {
            Self::Dedicated(ready) => ready.try_ready(ids),
            Self::Shared(ready) => ready.try_ready(ids),
        }
    }
    fn take_result(
        &self,
        id: u64,
    ) -> Result<crate::readiness_owner::CoreHostReadyTransfer, CoreHostReadyIoError> {
        match self {
            Self::Dedicated(ready) => ready.take_result(id),
            Self::Shared(ready) => ready.take_result(id),
        }
    }
    fn close(&mut self) -> Result<(), CoreHostReadyIoError> {
        match self {
            Self::Dedicated(ready) => ready.close(),
            Self::Shared(ready) => ready.close(),
        }
    }
}

pub struct HostEndpoint {
    owner: u64,
    ready: ReadyBackend,
    contexts: BTreeMap<u64, ReadyContext>,
    operation_timeout: Duration,
    max_write_chunk: usize,
    max_pending: usize,
    pending: usize,
    metrics: HostTransportMetrics,
    reactor_poll_start: u64,
    reactor_readiness_start: u64,
    counts_reactor_worker: bool,
    reactor_shard: Option<usize>,
}

fn map_ready_error(error: CoreHostReadyIoError) -> HostTransportError {
    match error {
        CoreHostReadyIoError::InvalidLimit => HostTransportError::Bounds,
        CoreHostReadyIoError::Capacity => HostTransportError::Busy,
        CoreHostReadyIoError::Stale => HostTransportError::InvalidResource,
        CoreHostReadyIoError::Cancelled => HostTransportError::Cancelled,
        CoreHostReadyIoError::Timeout => HostTransportError::Timeout,
        CoreHostReadyIoError::External | CoreHostReadyIoError::Closed => {
            HostTransportError::ExternalFailure
        }
    }
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
        let owner = NEXT_READY_ENDPOINT
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |value| {
                value.checked_add(1)
            })
            .map_err(|_| HostTransportError::Limit)?;
        #[cfg(feature = "readiness-dedicated")]
        let (
            ready,
            reactor_poll_start,
            reactor_readiness_start,
            counts_reactor_worker,
            initial_metrics,
            reactor_shard,
        ) = (
            ReadyBackend::Dedicated(
                CoreHostTcpReadinessOwner::new(stream, max_pending).map_err(map_ready_error)?,
            ),
            0,
            0,
            false,
            HostTransportMetrics {
                owner_threads_started: 1,
                ..HostTransportMetrics::default()
            },
            None,
        );
        #[cfg(feature = "reactor-candidate")]
        let (
            ready,
            reactor_poll_start,
            reactor_readiness_start,
            counts_reactor_worker,
            initial_metrics,
            reactor_shard,
        ) = {
            let reactors = shared_reactors()?;
            let shard =
                (NEXT_REACTOR_SHARD.fetch_add(1, Ordering::Relaxed) as usize) % reactors.len();
            let mut reactor = reactors[shard]
                .lock()
                .map_err(|_| HostTransportError::ExternalFailure)?;
            let before = reactor.metrics();
            (
                ReadyBackend::Shared(
                    reactor
                        .attach(stream, max_pending)
                        .map_err(map_ready_error)?,
                ),
                before.poll_calls,
                before.readiness_events,
                before.endpoints_attached == 0,
                HostTransportMetrics::default(),
                Some(shard),
            )
        };
        Ok(Self {
            owner,
            ready,
            contexts: BTreeMap::new(),
            operation_timeout,
            max_write_chunk,
            max_pending,
            pending: 0,
            metrics: initial_metrics,
            reactor_poll_start,
            reactor_readiness_start,
            counts_reactor_worker,
            reactor_shard,
        })
    }

    pub fn from_shared_endpoint(
        ready: CoreHostSharedTcpEndpoint,
        operation_timeout: Duration,
        max_write_chunk: usize,
        max_pending: usize,
    ) -> Result<Self, Box<dyn Error>> {
        if max_write_chunk == 0 || max_pending == 0 || operation_timeout.is_zero() {
            return Err(HostTransportError::Bounds.into());
        }
        let owner = NEXT_READY_ENDPOINT
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |value| {
                value.checked_add(1)
            })
            .map_err(|_| HostTransportError::Limit)?;
        Ok(Self {
            owner,
            ready: ReadyBackend::Shared(ready),
            contexts: BTreeMap::new(),
            operation_timeout,
            max_write_chunk,
            max_pending,
            pending: 0,
            metrics: HostTransportMetrics::default(),
            reactor_poll_start: 0,
            reactor_readiness_start: 0,
            counts_reactor_worker: false,
            reactor_shard: None,
        })
    }

    pub fn close_backend(&mut self) -> Result<(), HostTransportError> {
        if self.pending != 0 || !self.contexts.is_empty() {
            return Err(HostTransportError::Busy);
        }
        self.ready.close().map_err(map_ready_error)
    }

    pub fn metrics(&self) -> HostTransportMetrics {
        let mut metrics = self.metrics;
        let ready = self.ready.metrics();
        metrics.cancellations = ready.cancelled;
        metrics.timeouts = ready.timed_out;
        metrics.backpressure_rejections = metrics
            .backpressure_rejections
            .saturating_add(ready.capacity_rejected);
        match &self.ready {
            ReadyBackend::Dedicated(_) => {
                metrics.owner_wake_cycles = ready.poll_calls;
            }
            ReadyBackend::Shared(_) => {
                if let Some(shard) = self.reactor_shard {
                    if let Ok(reactors) = shared_reactors() {
                        if let Ok(reactor) = reactors[shard].lock() {
                            let shared = reactor.metrics();
                            metrics.reactor_poll_calls =
                                shared.poll_calls.saturating_sub(self.reactor_poll_start);
                            metrics.reactor_readiness_events = shared
                                .readiness_events
                                .saturating_sub(self.reactor_readiness_start);
                            if self.counts_reactor_worker {
                                metrics.owner_threads_started = shared.worker_threads;
                                metrics.placement_requested = shared.placement_requested;
                                metrics.placement_applied = shared.placement_applied;
                            }
                        }
                    }
                } else {
                    if let Ok(reactors) = shared_reactors() {
                        let mut poll_calls = 0u64;
                        let mut readiness_events = 0u64;
                        let mut worker_threads = 0u64;
                        let mut placement_requested = 0u64;
                        let mut placement_applied = 0u64;
                        for reactor in reactors {
                            if let Ok(reactor) = reactor.lock() {
                                let shared = reactor.metrics();
                                poll_calls = poll_calls.saturating_add(shared.poll_calls);
                                readiness_events =
                                    readiness_events.saturating_add(shared.readiness_events);
                                worker_threads =
                                    worker_threads.saturating_add(shared.worker_threads);
                                placement_requested =
                                    placement_requested.saturating_add(shared.placement_requested);
                                placement_applied =
                                    placement_applied.saturating_add(shared.placement_applied);
                            }
                        }
                        metrics.reactor_poll_calls =
                            poll_calls.saturating_sub(self.reactor_poll_start);
                        metrics.reactor_readiness_events =
                            readiness_events.saturating_sub(self.reactor_readiness_start);
                        if self.counts_reactor_worker {
                            metrics.owner_threads_started = worker_threads;
                            metrics.placement_requested = placement_requested;
                            metrics.placement_applied = placement_applied;
                        }
                    }
                }
            }
        }
        metrics
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
        self.issue_ready(
            ReadyContext::Read {
                destination: destination.bytes.clone(),
                capacity: destination.capacity,
            },
            ReadyIssue::Read(length as u32),
        )
    }

    pub fn write(&mut self, source: &HostWindow) -> Result<HostOperation, HostTransportError> {
        let (bytes, requested, physical) = source.shared_prefix(self.max_write_chunk);
        if requested == 0 {
            return Err(HostTransportError::Bounds);
        }
        self.issue_ready(
            ReadyContext::Write { requested },
            ReadyIssue::WriteShared {
                bytes,
                length: physical as u32,
            },
        )
    }

    pub fn cancel(&mut self, operation: &HostOperation) -> Result<(), HostTransportError> {
        self.validate_ready(operation)?;
        self.ready.cancel(operation.id).map_err(map_ready_error)
    }

    pub fn try_wait(&self, selected: &[&HostOperation]) -> Result<Vec<u32>, HostTransportError> {
        if selected.is_empty() {
            return Err(HostTransportError::Bounds);
        }
        for operation in selected {
            self.validate_ready(operation)?;
        }
        let ids = selected
            .iter()
            .map(|operation| operation.id)
            .collect::<Vec<_>>();
        self.ready.try_ready(&ids).map_err(map_ready_error)
    }

    pub fn wait(&mut self, selected: &[&HostOperation]) -> Result<Vec<u32>, HostTransportError> {
        if selected.is_empty() {
            return Err(HostTransportError::Bounds);
        }
        for operation in selected {
            self.validate_ready(operation)?;
        }
        self.metrics.waits = self.metrics.waits.saturating_add(1);
        let ids = selected
            .iter()
            .map(|operation| operation.id)
            .collect::<Vec<_>>();
        self.ready
            .wait_any(&ids, Instant::now() + self.operation_timeout)
            .map_err(map_ready_error)
    }

    pub fn take_result(
        &mut self,
        operation: &mut HostOperation,
    ) -> Result<Terminal, HostTransportError> {
        self.validate_ready(operation)?;
        if operation.claimed {
            return Err(HostTransportError::AlreadyTerminal);
        }
        self.take_ready_result(operation)
    }

    /// Non-blocking terminal claim used to qualify the Host ABI v1 rule that
    /// `wait` is optional. A pending operation returns `Busy` without consuming
    /// its context, claim state, or pending quota.
    pub fn try_take_result(
        &mut self,
        operation: &mut HostOperation,
    ) -> Result<Terminal, HostTransportError> {
        self.validate_ready(operation)?;
        if operation.claimed {
            return Err(HostTransportError::AlreadyTerminal);
        }
        let ready = self
            .ready
            .try_ready(&[operation.id])
            .map_err(map_ready_error)?;
        if ready.is_empty() {
            return Err(HostTransportError::Busy);
        }
        self.take_ready_result(operation)
    }

    fn take_ready_result(
        &mut self,
        operation: &mut HostOperation,
    ) -> Result<Terminal, HostTransportError> {
        let context = self
            .contexts
            .remove(&operation.id)
            .ok_or(HostTransportError::InvalidResource)?;
        let result = self
            .ready
            .take_result(operation.id)
            .map_err(map_ready_error);
        operation.claimed = true;
        self.pending = self.pending.saturating_sub(1);
        self.metrics.results_claimed = self.metrics.results_claimed.saturating_add(1);
        let transfer = result?;
        match context {
            ReadyContext::Read {
                destination,
                capacity,
            } => {
                if transfer.bytes.len() > capacity {
                    return Err(HostTransportError::Bounds);
                }
                let mut target = destination.lock().unwrap();
                *target = Arc::new(transfer.bytes);
                self.metrics.read_operations = self.metrics.read_operations.saturating_add(1);
                self.metrics.read_bytes = self
                    .metrics
                    .read_bytes
                    .saturating_add(transfer.transferred as u64);
                if transfer.eof {
                    self.metrics.eof_transfers = self.metrics.eof_transfers.saturating_add(1);
                }
                Ok(Terminal::Transfer(Transfer {
                    transferred: transfer.transferred,
                    eof: transfer.eof,
                    message_complete: false,
                }))
            }
            ReadyContext::Write { requested } => {
                self.metrics.write_operations = self.metrics.write_operations.saturating_add(1);
                self.metrics.write_bytes = self
                    .metrics
                    .write_bytes
                    .saturating_add(transfer.transferred as u64);
                if (transfer.transferred as usize) < requested {
                    self.metrics.partial_writes = self.metrics.partial_writes.saturating_add(1);
                }
                Ok(Terminal::Transfer(Transfer {
                    transferred: transfer.transferred,
                    eof: false,
                    message_complete: transfer.transferred as usize == requested,
                }))
            }
        }
    }

    fn validate_ready(&self, operation: &HostOperation) -> Result<(), HostTransportError> {
        if operation.owner != self.owner {
            return Err(HostTransportError::InvalidResource);
        }
        Ok(())
    }

    fn issue_ready(
        &mut self,
        context: ReadyContext,
        effect: ReadyIssue,
    ) -> Result<HostOperation, HostTransportError> {
        if self.pending >= self.max_pending {
            self.metrics.backpressure_rejections =
                self.metrics.backpressure_rejections.saturating_add(1);
            return Err(HostTransportError::Busy);
        }
        let deadline = Instant::now() + self.operation_timeout;
        let id = match effect {
            ReadyIssue::Read(length) => self.ready.read(length, deadline),
            ReadyIssue::WriteShared { bytes, length } => {
                self.ready.write_shared(bytes, length, deadline)
            }
        }
        .map_err(map_ready_error)?;
        self.contexts.insert(id, context);
        self.pending += 1;
        self.metrics.operations_issued = self.metrics.operations_issued.saturating_add(1);
        self.metrics.pending_issued = self.metrics.pending_issued.saturating_add(1);
        self.metrics.pending_peak = self.metrics.pending_peak.max(self.pending as u64);
        Ok(HostOperation {
            id,
            owner: self.owner,
            claimed: false,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
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

    #[test]
    fn direct_take_busy_preserves_pending_operation_and_later_claims_once() {
        let (mut endpoint, mut peer) = pair();
        let mut window = HostWindow::acquire(8).unwrap();
        let mut read = endpoint.read(&mut window, 8).unwrap();

        assert_eq!(
            endpoint.try_take_result(&mut read),
            Err(HostTransportError::Busy)
        );
        assert_eq!(endpoint.metrics().results_claimed, 0);

        peer.write_all(b"abc").unwrap();
        endpoint.wait(&[&read]).unwrap();
        assert_eq!(
            endpoint.try_take_result(&mut read).unwrap(),
            Terminal::Transfer(Transfer {
                transferred: 3,
                eof: false,
                message_complete: false,
            })
        );
        assert_eq!(window.copy_out(), b"abc");
        assert_eq!(
            endpoint.try_take_result(&mut read),
            Err(HostTransportError::AlreadyTerminal)
        );
        assert_eq!(endpoint.metrics().results_claimed, 1);
    }
}
