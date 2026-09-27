use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    error::Error,
    ffi::CString,
    fmt, fs,
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddr, SocketAddrV4},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

const DEFAULT_MAX_PENDING: usize = 64;
static NEXT_OWNER: AtomicU64 = AtomicU64::new(1);

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

#[derive(Debug, Clone)]
pub struct HostWindow {
    bytes: Arc<Mutex<Vec<u8>>>,
    capacity: usize,
}

impl HostWindow {
    pub fn acquire(capacity: u32) -> Result<Self, HostTransportError> {
        if capacity == 0 {
            return Err(HostTransportError::Bounds);
        }
        Ok(Self {
            bytes: Arc::new(Mutex::new(Vec::new())),
            capacity: capacity as usize,
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

type Invoke = unsafe extern "C" fn(*const u8, usize, *mut u8, usize, *mut usize) -> i32;

#[derive(Deserialize)]
struct Descriptor {
    schema: String,
    identity: String,
    adapter: Adapter,
    limits: Limits,
}

#[derive(Deserialize)]
struct Adapter {
    path: String,
    sha256: String,
    export: String,
}

#[derive(Deserialize)]
struct Limits {
    max_input_bytes: usize,
    max_output_bytes: usize,
}

struct DirectBoundary {
    library: *mut libc::c_void,
    invoke: Invoke,
    limits: Limits,
    output: Vec<u8>,
    next_operation: u64,
}

unsafe impl Send for DirectBoundary {}

impl DirectBoundary {
    fn load(descriptor_path: &Path) -> Result<Self, HostTransportError> {
        let descriptor: Descriptor = serde_json::from_slice(
            &fs::read(descriptor_path).map_err(|_| HostTransportError::InvalidResource)?,
        )
        .map_err(|_| HostTransportError::InvalidResource)?;
        if descriptor.schema != "wasmc.native-boundary-descriptor/v1"
            || descriptor.identity.is_empty()
        {
            return Err(HostTransportError::InvalidResource);
        }
        let root = descriptor_path
            .parent()
            .ok_or(HostTransportError::InvalidResource)?
            .canonicalize()
            .map_err(|_| HostTransportError::InvalidResource)?;
        let adapter_path = root
            .join(&descriptor.adapter.path)
            .canonicalize()
            .map_err(|_| HostTransportError::InvalidResource)?;
        if adapter_path.parent() != Some(root.as_path()) {
            return Err(HostTransportError::InvalidResource);
        }
        let adapter_bytes =
            fs::read(&adapter_path).map_err(|_| HostTransportError::InvalidResource)?;
        let digest = Sha256::digest(&adapter_bytes)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        if digest != descriptor.adapter.sha256 {
            return Err(HostTransportError::InvalidResource);
        }
        let library_name = CString::new(adapter_path.as_os_str().as_encoded_bytes())
            .map_err(|_| HostTransportError::InvalidResource)?;
        let export = CString::new(descriptor.adapter.export)
            .map_err(|_| HostTransportError::InvalidResource)?;
        let library =
            unsafe { libc::dlopen(library_name.as_ptr(), libc::RTLD_NOW | libc::RTLD_LOCAL) };
        if library.is_null() {
            return Err(HostTransportError::ExternalFailure);
        }
        let symbol = unsafe { libc::dlsym(library, export.as_ptr()) };
        if symbol.is_null() {
            unsafe { libc::dlclose(library) };
            return Err(HostTransportError::ExternalFailure);
        }
        let invoke = unsafe { std::mem::transmute::<*mut libc::c_void, Invoke>(symbol) };
        let output = vec![0u8; descriptor.limits.max_output_bytes.max(1)];
        Ok(Self {
            library,
            invoke,
            limits: descriptor.limits,
            output,
            next_operation: 1,
        })
    }

    fn invoke(
        &mut self,
        payload: &[u8],
        output_capacity: u32,
    ) -> Result<(u64, i32, Vec<u8>), HostTransportError> {
        let output_capacity = output_capacity as usize;
        if payload.len() > self.limits.max_input_bytes
            || output_capacity > self.limits.max_output_bytes
        {
            return Err(HostTransportError::Bounds);
        }
        let token = self.next_operation;
        self.next_operation = self
            .next_operation
            .checked_add(1)
            .ok_or(HostTransportError::Limit)?;
        let mut output_len = 0usize;
        let status = unsafe {
            (self.invoke)(
                payload.as_ptr(),
                payload.len(),
                self.output.as_mut_ptr(),
                output_capacity,
                &mut output_len,
            )
        };
        if output_len > output_capacity {
            return Err(HostTransportError::ExternalFailure);
        }
        Ok((token, status, self.output[..output_len].to_vec()))
    }
}

impl Drop for DirectBoundary {
    fn drop(&mut self) {
        unsafe { libc::dlclose(self.library) };
    }
}

struct Bridge {
    child: Option<Child>,
    input: Option<ChildStdin>,
    output: Option<ChildStdout>,
    direct: Option<DirectBoundary>,
}

impl Bridge {
    fn start() -> Result<Self, HostTransportError> {
        let executor = std::env::var_os("WASMC_LIB_BOUNDARY_EXECUTOR")
            .ok_or(HostTransportError::InvalidResource)?;
        let descriptor = std::env::var_os("WASMC_LIB_SOCKET_DESCRIPTOR")
            .ok_or(HostTransportError::InvalidResource)?;
        if std::env::var_os("WASMC_LIB_BOUNDARY_IN_PROCESS").is_some() {
            return Ok(Self {
                child: None,
                input: None,
                output: None,
                direct: Some(DirectBoundary::load(&PathBuf::from(descriptor))?),
            });
        }
        let mut child = Command::new(executor)
            .arg("--operation-session")
            .arg(descriptor)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|_| HostTransportError::ExternalFailure)?;
        let input = child
            .stdin
            .take()
            .ok_or(HostTransportError::ExternalFailure)?;
        let output = child
            .stdout
            .take()
            .ok_or(HostTransportError::ExternalFailure)?;
        Ok(Self {
            child: Some(child),
            input: Some(input),
            output: Some(output),
            direct: None,
        })
    }

    fn request(&mut self, payload: &[u8]) -> Result<Vec<u8>, HostTransportError> {
        let input = self
            .input
            .as_mut()
            .ok_or(HostTransportError::InvalidResource)?;
        input
            .write_all(&(payload.len() as u32).to_le_bytes())
            .and_then(|()| input.write_all(payload))
            .and_then(|()| input.flush())
            .map_err(|_| HostTransportError::ExternalFailure)?;
        let mut header = [0u8; 8];
        self.output
            .as_mut()
            .ok_or(HostTransportError::InvalidResource)?
            .read_exact(&mut header)
            .map_err(|_| HostTransportError::ExternalFailure)?;
        let status = i32::from_le_bytes(header[..4].try_into().unwrap());
        let length = u32::from_le_bytes(header[4..].try_into().unwrap()) as usize;
        let mut output = vec![0u8; length];
        self.output
            .as_mut()
            .ok_or(HostTransportError::InvalidResource)?
            .read_exact(&mut output)
            .map_err(|_| HostTransportError::ExternalFailure)?;
        if status != 0 {
            return Err(map_bridge_status(status));
        }
        Ok(output)
    }

    fn submit(&mut self, payload: &[u8], output_capacity: u32) -> Result<u64, HostTransportError> {
        let mut command = Vec::with_capacity(5 + payload.len());
        command.push(1);
        command.extend_from_slice(&output_capacity.to_le_bytes());
        command.extend_from_slice(payload);
        let output = self.request(&command)?;
        output
            .as_slice()
            .try_into()
            .map(u64::from_le_bytes)
            .map_err(|_| HostTransportError::ExternalFailure)
    }

    fn wait(&mut self, operation: u64, timeout: Duration) -> Result<u8, HostTransportError> {
        let timeout_ms =
            u32::try_from(timeout.as_millis()).map_err(|_| HostTransportError::Bounds)?;
        let mut command = Vec::with_capacity(13);
        command.push(3);
        command.extend_from_slice(&operation.to_le_bytes());
        command.extend_from_slice(&timeout_ms.to_le_bytes());
        let output = self.request(&command)?;
        output
            .first()
            .copied()
            .ok_or(HostTransportError::ExternalFailure)
    }

    fn settle(
        &mut self,
        operation: u64,
        timeout: Duration,
    ) -> Result<(i32, Vec<u8>), HostTransportError> {
        let timeout_ms =
            u32::try_from(timeout.as_millis()).map_err(|_| HostTransportError::Bounds)?;
        let mut command = Vec::with_capacity(13);
        command.push(7);
        command.extend_from_slice(&operation.to_le_bytes());
        command.extend_from_slice(&timeout_ms.to_le_bytes());
        let output = self.request(&command)?;
        if output.len() < 4 {
            return Err(HostTransportError::ExternalFailure);
        }
        Ok((
            i32::from_le_bytes(output[..4].try_into().unwrap()),
            output[4..].to_vec(),
        ))
    }

    fn submit_settle(
        &mut self,
        payload: &[u8],
        output_capacity: u32,
        timeout: Duration,
    ) -> Result<(u64, i32, Vec<u8>), HostTransportError> {
        if let Some(direct) = self.direct.as_mut() {
            return direct.invoke(payload, output_capacity);
        }
        let timeout_ms =
            u32::try_from(timeout.as_millis()).map_err(|_| HostTransportError::Bounds)?;
        let mut command = Vec::with_capacity(9 + payload.len());
        command.push(8);
        command.extend_from_slice(&output_capacity.to_le_bytes());
        command.extend_from_slice(&timeout_ms.to_le_bytes());
        command.extend_from_slice(payload);
        let output = self.request(&command)?;
        if output.len() < 12 {
            return Err(HostTransportError::ExternalFailure);
        }
        Ok((
            u64::from_le_bytes(output[..8].try_into().unwrap()),
            i32::from_le_bytes(output[8..12].try_into().unwrap()),
            output[12..].to_vec(),
        ))
    }

    fn cancel(&mut self, operation: u64) -> Result<(), HostTransportError> {
        self.token_command(4, operation).map(|_| ())
    }

    fn take(&mut self, operation: u64) -> Result<(i32, Vec<u8>), HostTransportError> {
        let output = self.token_command(5, operation)?;
        if output.len() < 4 {
            return Err(HostTransportError::ExternalFailure);
        }
        Ok((
            i32::from_le_bytes(output[..4].try_into().unwrap()),
            output[4..].to_vec(),
        ))
    }

    fn release(&mut self, operation: u64) -> Result<(), HostTransportError> {
        self.token_command(6, operation).map(|_| ())
    }

    fn invoke(
        &mut self,
        payload: &[u8],
        output_capacity: u32,
    ) -> Result<Vec<u8>, HostTransportError> {
        let (_, status, output) =
            self.submit_settle(payload, output_capacity, Duration::from_secs(5))?;
        if status != 0 {
            return Err(HostTransportError::ExternalFailure);
        }
        Ok(output)
    }

    fn token_command(
        &mut self,
        command_id: u8,
        operation: u64,
    ) -> Result<Vec<u8>, HostTransportError> {
        let mut command = Vec::with_capacity(9);
        command.push(command_id);
        command.extend_from_slice(&operation.to_le_bytes());
        self.request(&command)
    }
}

impl Drop for Bridge {
    fn drop(&mut self) {
        self.input.take();
        if let Some(child) = self.child.as_mut() {
            let _ = child.wait();
        }
    }
}

fn map_bridge_status(status: i32) -> HostTransportError {
    match status {
        -9 => HostTransportError::InvalidResource,
        -16 => HostTransportError::Busy,
        -22 => HostTransportError::Bounds,
        -110 => HostTransportError::Timeout,
        -114 => HostTransportError::AlreadyTerminal,
        -125 => HostTransportError::Cancelled,
        _ => HostTransportError::ExternalFailure,
    }
}

fn adapter_token(operation: u8, token: u64) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(9);
    bytes.push(operation);
    bytes.extend_from_slice(&token.to_le_bytes());
    bytes
}

#[derive(Clone)]
pub struct LibSocketListener {
    bridge: Arc<Mutex<Bridge>>,
    token: u64,
    address: SocketAddr,
}

impl LibSocketListener {
    pub fn bind_loopback(port: u16) -> Result<Self, HostTransportError> {
        let mut bridge = Bridge::start()?;
        let mut bind = Vec::with_capacity(11);
        bind.push(1);
        bind.extend_from_slice(&[127, 0, 0, 1]);
        bind.extend_from_slice(&port.to_le_bytes());
        bind.extend_from_slice(&128u32.to_le_bytes());
        let token_bytes = bridge.invoke(&bind, 8)?;
        let token = u64::from_le_bytes(
            token_bytes
                .as_slice()
                .try_into()
                .map_err(|_| HostTransportError::ExternalFailure)?,
        );
        let endpoint = bridge.invoke(&adapter_token(4, token), 6)?;
        if endpoint.len() != 6 {
            return Err(HostTransportError::ExternalFailure);
        }
        let address = SocketAddr::V4(SocketAddrV4::new(
            Ipv4Addr::new(endpoint[0], endpoint[1], endpoint[2], endpoint[3]),
            u16::from_le_bytes(endpoint[4..6].try_into().unwrap()),
        ));
        Ok(Self {
            bridge: Arc::new(Mutex::new(bridge)),
            token,
            address,
        })
    }

    pub fn local_addr(&self) -> SocketAddr {
        self.address
    }

    pub fn accept(&self) -> Result<HostEndpoint, HostTransportError> {
        let output = self
            .bridge
            .lock()
            .unwrap()
            .invoke(&adapter_token(3, self.token), 14)?;
        if output.len() != 14 {
            return Err(HostTransportError::ExternalFailure);
        }
        let token = u64::from_le_bytes(output[..8].try_into().unwrap());
        HostEndpoint::from_lib_stream(self.bridge.clone(), token)
    }
}

enum PendingKind {
    Read {
        destination: Arc<Mutex<Vec<u8>>>,
        capacity: usize,
    },
    Write {
        requested: usize,
    },
}

pub struct HostEndpoint {
    owner: u64,
    bridge: Arc<Mutex<Bridge>>,
    stream: u64,
    contexts: BTreeMap<u64, PendingKind>,
    completions: BTreeMap<u64, (i32, Vec<u8>)>,
    operation_timeout: Duration,
    max_write_chunk: usize,
    max_pending: usize,
    metrics: HostTransportMetrics,
    closed: bool,
}

impl HostEndpoint {
    fn from_lib_stream(
        bridge: Arc<Mutex<Bridge>>,
        stream: u64,
    ) -> Result<Self, HostTransportError> {
        let max_write_chunk = std::env::var("WASMC_HOST_TRANSPORT_MAX_WRITE")
            .ok()
            .map(|value| value.parse::<usize>())
            .transpose()
            .map_err(|_| HostTransportError::Bounds)?
            .unwrap_or(usize::MAX);
        if max_write_chunk == 0 {
            return Err(HostTransportError::Bounds);
        }
        let owner = NEXT_OWNER
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |value| {
                value.checked_add(1)
            })
            .map_err(|_| HostTransportError::Limit)?;
        Ok(Self {
            owner,
            bridge,
            stream,
            contexts: BTreeMap::new(),
            completions: BTreeMap::new(),
            operation_timeout: Duration::from_secs(5),
            max_write_chunk,
            max_pending: DEFAULT_MAX_PENDING,
            metrics: HostTransportMetrics::default(),
            closed: false,
        })
    }

    pub fn metrics(&self) -> HostTransportMetrics {
        self.metrics
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
        let mut payload = adapter_token(6, self.stream);
        payload.extend_from_slice(&(length as u32).to_le_bytes());
        let operation = self.issue(&payload, length as u32)?;
        self.contexts.insert(
            operation.id,
            PendingKind::Read {
                destination: destination.bytes.clone(),
                capacity: destination.capacity,
            },
        );
        Ok(operation)
    }

    pub fn write(&mut self, source: &HostWindow) -> Result<HostOperation, HostTransportError> {
        let bytes = source.copy_out();
        if bytes.is_empty() {
            return Err(HostTransportError::Bounds);
        }
        let physical = bytes.len().min(self.max_write_chunk);
        let mut payload = adapter_token(7, self.stream);
        payload.extend_from_slice(&(physical as u32).to_le_bytes());
        payload.extend_from_slice(&bytes[..physical]);
        let operation = self.issue(&payload, 8)?;
        self.contexts.insert(
            operation.id,
            PendingKind::Write {
                requested: bytes.len(),
            },
        );
        Ok(operation)
    }

    pub fn cancel(&mut self, operation: &HostOperation) -> Result<(), HostTransportError> {
        self.validate(operation)?;
        if self.completions.contains_key(&operation.id) {
            return Err(HostTransportError::AlreadyTerminal);
        }
        self.bridge.lock().unwrap().cancel(operation.id)?;
        self.metrics.cancellations = self.metrics.cancellations.saturating_add(1);
        Ok(())
    }

    pub fn wait(&mut self, selected: &[&HostOperation]) -> Result<Vec<u32>, HostTransportError> {
        if selected.is_empty() {
            return Err(HostTransportError::Bounds);
        }
        for operation in selected {
            self.validate(operation)?;
        }
        self.metrics.waits = self.metrics.waits.saturating_add(1);
        if self.completions.contains_key(&selected[0].id) {
            return Ok(vec![0]);
        }
        let completion = self
            .bridge
            .lock()
            .unwrap()
            .settle(selected[0].id, self.operation_timeout)?;
        self.completions.insert(selected[0].id, completion);
        Ok(vec![0])
    }

    pub fn take_result(
        &mut self,
        operation: &mut HostOperation,
    ) -> Result<Terminal, HostTransportError> {
        self.validate(operation)?;
        if operation.claimed {
            return Err(HostTransportError::AlreadyTerminal);
        }
        let context = self
            .contexts
            .remove(&operation.id)
            .ok_or(HostTransportError::Busy)?;
        let (status, output) = self
            .completions
            .remove(&operation.id)
            .ok_or(HostTransportError::Busy)?;
        operation.claimed = true;
        self.metrics.results_claimed = self.metrics.results_claimed.saturating_add(1);
        if status != 0 {
            return Err(HostTransportError::ExternalFailure);
        }
        match context {
            PendingKind::Read {
                destination,
                capacity,
            } => {
                if output.len() > capacity {
                    return Err(HostTransportError::Bounds);
                }
                let mut bytes = destination.lock().unwrap();
                bytes.clear();
                bytes.extend_from_slice(&output);
                self.metrics.read_operations = self.metrics.read_operations.saturating_add(1);
                self.metrics.read_bytes =
                    self.metrics.read_bytes.saturating_add(output.len() as u64);
                if output.is_empty() {
                    self.metrics.eof_transfers = self.metrics.eof_transfers.saturating_add(1);
                }
                Ok(Terminal::Transfer(Transfer {
                    transferred: output.len() as u32,
                    eof: output.is_empty(),
                    message_complete: false,
                }))
            }
            PendingKind::Write { requested } => {
                if output.len() != 8 {
                    return Err(HostTransportError::ExternalFailure);
                }
                let transferred = u64::from_le_bytes(output.try_into().unwrap()) as usize;
                self.metrics.write_operations = self.metrics.write_operations.saturating_add(1);
                self.metrics.write_bytes =
                    self.metrics.write_bytes.saturating_add(transferred as u64);
                if transferred < requested {
                    self.metrics.partial_writes = self.metrics.partial_writes.saturating_add(1);
                }
                Ok(Terminal::Transfer(Transfer {
                    transferred: transferred as u32,
                    eof: false,
                    message_complete: transferred == requested,
                }))
            }
        }
    }

    pub fn close_backend(&mut self) -> Result<(), HostTransportError> {
        if !self.contexts.is_empty() || !self.completions.is_empty() {
            return Err(HostTransportError::Busy);
        }
        if !self.closed {
            self.bridge
                .lock()
                .unwrap()
                .invoke(&adapter_token(10, self.stream), 0)?;
            self.closed = true;
        }
        Ok(())
    }

    fn issue(
        &mut self,
        payload: &[u8],
        output_capacity: u32,
    ) -> Result<HostOperation, HostTransportError> {
        if self.closed {
            return Err(HostTransportError::InvalidResource);
        }
        if self.contexts.len() >= self.max_pending {
            self.metrics.backpressure_rejections =
                self.metrics.backpressure_rejections.saturating_add(1);
            return Err(HostTransportError::Busy);
        }
        let (id, status, output) = self.bridge.lock().unwrap().submit_settle(
            payload,
            output_capacity,
            self.operation_timeout,
        )?;
        self.completions.insert(id, (status, output));
        self.metrics.operations_issued = self.metrics.operations_issued.saturating_add(1);
        self.metrics.pending_issued = self.metrics.pending_issued.saturating_add(1);
        self.metrics.pending_peak = self
            .metrics
            .pending_peak
            .max((self.contexts.len() + 1) as u64);
        Ok(HostOperation {
            id,
            owner: self.owner,
            claimed: false,
        })
    }

    fn validate(&self, operation: &HostOperation) -> Result<(), HostTransportError> {
        if operation.owner != self.owner {
            Err(HostTransportError::InvalidResource)
        } else {
            Ok(())
        }
    }
}

impl Drop for HostEndpoint {
    fn drop(&mut self) {
        let _ = self.close_backend();
    }
}
