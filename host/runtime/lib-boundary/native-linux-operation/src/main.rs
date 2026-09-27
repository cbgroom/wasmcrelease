#[cfg(not(target_os = "linux"))]
compile_error!("the native Linux boundary executor must be built on Linux");

use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::env;
use std::ffi::{CStr, CString, c_char, c_int, c_void};
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
#[cfg(feature = "operation-bridge")]
use std::{
    collections::BTreeMap,
    sync::{Arc, Condvar, Mutex, mpsc},
    thread::{self, JoinHandle},
    time::Duration,
};

const RTLD_NOW: c_int = 2;
const RTLD_LOCAL: c_int = 0;
#[cfg(feature = "operation-bridge")]
const MAX_OPERATIONS: usize = 64;
#[cfg(feature = "operation-bridge")]
const EINVAL: i32 = 22;
#[cfg(feature = "operation-bridge")]
const EBADF: i32 = 9;
#[cfg(feature = "operation-bridge")]
const EBUSY: i32 = 16;
#[cfg(feature = "operation-bridge")]
const EALREADY: i32 = 114;
#[cfg(feature = "operation-bridge")]
const ETIMEDOUT: i32 = 110;
#[cfg(feature = "operation-bridge")]
const EOVERFLOW: i32 = 75;

unsafe extern "C" {
    fn dlopen(filename: *const c_char, flags: c_int) -> *mut c_void;
    fn dlsym(handle: *mut c_void, symbol: *const c_char) -> *mut c_void;
    fn dlclose(handle: *mut c_void) -> c_int;
    fn dlerror() -> *const c_char;
}

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

struct Library(*mut c_void);

impl Drop for Library {
    fn drop(&mut self) {
        unsafe {
            dlclose(self.0);
        }
    }
}

type Invoke = unsafe extern "C" fn(
    input: *const u8,
    input_len: usize,
    output: *mut u8,
    output_capacity: usize,
    output_len: *mut usize,
) -> i32;

struct NativeBoundary {
    descriptor: Descriptor,
    _library: Library,
    invoke: Invoke,
    output: Vec<u8>,
}

impl NativeBoundary {
    fn load(descriptor_path: &Path) -> Result<Self, String> {
        let descriptor: Descriptor =
            serde_json::from_slice(&fs::read(descriptor_path).map_err(|error| error.to_string())?)
                .map_err(|error| error.to_string())?;
        if descriptor.schema != "wasmc.native-boundary-descriptor/v1" {
            return Err("unsupported descriptor schema".into());
        }
        if descriptor.identity.is_empty() {
            return Err("missing exact Lib identity".into());
        }
        if descriptor.limits.max_input_bytes > u32::MAX as usize
            || descriptor.limits.max_output_bytes > u32::MAX as usize
        {
            return Err("descriptor limits exceed framing capacity".into());
        }
        let adapter_path = canonical_adapter(descriptor_path, &descriptor.adapter.path)?;
        let adapter_bytes = fs::read(&adapter_path).map_err(|error| error.to_string())?;
        if hex_sha256(&adapter_bytes) != descriptor.adapter.sha256 {
            return Err("adapter identity mismatch".into());
        }
        let library_name = CString::new(adapter_path.as_os_str().as_encoded_bytes())
            .map_err(|_| "invalid adapter path")?;
        let symbol_name = CString::new(descriptor.adapter.export.as_bytes())
            .map_err(|_| "invalid adapter export")?;
        let handle = unsafe { dlopen(library_name.as_ptr(), RTLD_NOW | RTLD_LOCAL) };
        if handle.is_null() {
            return Err(dynamic_error("dlopen failed"));
        }
        let library = Library(handle);
        let symbol = unsafe { dlsym(library.0, symbol_name.as_ptr()) };
        if symbol.is_null() {
            return Err(dynamic_error("dlsym failed"));
        }
        let invoke: Invoke = unsafe { std::mem::transmute(symbol) };
        let output = vec![0u8; descriptor.limits.max_output_bytes];
        Ok(Self {
            descriptor,
            _library: library,
            invoke,
            output,
        })
    }

    fn call(&mut self, input: &[u8]) -> Result<(i32, &[u8]), String> {
        if input.len() > self.descriptor.limits.max_input_bytes {
            return Err("input limit".into());
        }
        let mut output_len = 0usize;
        let status = unsafe {
            (self.invoke)(
                input.as_ptr(),
                input.len(),
                self.output.as_mut_ptr(),
                self.output.len(),
                &mut output_len,
            )
        };
        if output_len > self.output.len() {
            return Err("adapter returned invalid output length".into());
        }
        Ok((status, &self.output[..output_len]))
    }
}

fn hex_sha256(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn canonical_adapter(descriptor_path: &Path, relative: &str) -> Result<PathBuf, String> {
    let root = descriptor_path
        .parent()
        .ok_or("descriptor has no parent")?
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let adapter = root
        .join(relative)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if adapter.parent() != Some(root.as_path()) {
        return Err("adapter must be an exact sibling of its descriptor".into());
    }
    Ok(adapter)
}

fn dynamic_error(prefix: &str) -> String {
    unsafe {
        let pointer = dlerror();
        if pointer.is_null() {
            prefix.into()
        } else {
            format!("{prefix}: {}", CStr::from_ptr(pointer).to_string_lossy())
        }
    }
}

fn run_once(descriptor_path: &Path, input_path: &Path, output_path: &Path) -> Result<(), String> {
    let mut boundary = NativeBoundary::load(descriptor_path)?;
    let input = fs::read(input_path).map_err(|error| error.to_string())?;
    let identity = boundary.descriptor.identity.clone();
    let adapter_sha256 = boundary.descriptor.adapter.sha256.clone();
    let (status, output) = boundary.call(&input)?;
    if status != 0 {
        return Err(format!("adapter failed with status {status}"));
    }
    fs::write(output_path, output).map_err(|error| error.to_string())?;
    println!(
        "{}",
        serde_json::json!({
            "accepted": true,
            "schema": "wasmc.lib-defined-native-linux/v1",
            "identity": identity,
            "adapter_sha256": adapter_sha256,
            "input_bytes": input.len(),
            "output_bytes": output.len()
        })
    );
    Ok(())
}

fn run_session(descriptor_path: &Path) -> Result<(), String> {
    let mut boundary = NativeBoundary::load(descriptor_path)?;
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = stdin.lock();
    let mut writer = stdout.lock();
    loop {
        let mut length_bytes = [0u8; 4];
        match reader.read(&mut length_bytes[..1]) {
            Ok(0) => return Ok(()),
            Ok(1) => reader
                .read_exact(&mut length_bytes[1..])
                .map_err(|error| error.to_string())?,
            Ok(_) => unreachable!(),
            Err(error) => return Err(error.to_string()),
        }
        let input_len = u32::from_le_bytes(length_bytes) as usize;
        if input_len > boundary.descriptor.limits.max_input_bytes {
            return Err("session input limit".into());
        }
        let mut input = vec![0u8; input_len];
        reader
            .read_exact(&mut input)
            .map_err(|error| error.to_string())?;
        let (status, output) = boundary.call(&input)?;
        writer
            .write_all(&status.to_le_bytes())
            .and_then(|()| writer.write_all(&(output.len() as u32).to_le_bytes()))
            .and_then(|()| writer.write_all(output))
            .and_then(|()| writer.flush())
            .map_err(|error| error.to_string())?;
    }
}

#[cfg(feature = "operation-bridge")]
enum OperationState {
    Pending,
    CancelRequested,
    Completed {
        status: i32,
        output: Option<Vec<u8>>,
    },
    CancelledDrained,
    Claimed,
}

#[cfg(feature = "operation-bridge")]
struct OperationCell {
    state: Mutex<OperationState>,
    changed: Condvar,
}

#[cfg(feature = "operation-bridge")]
struct OperationRecord {
    cell: Arc<OperationCell>,
}

#[cfg(feature = "operation-bridge")]
struct OperationTask {
    invoke: Invoke,
    input: Vec<u8>,
    output_capacity: usize,
    cell: Arc<OperationCell>,
}

#[cfg(feature = "operation-bridge")]
fn run_operation_worker(tasks: Arc<Mutex<mpsc::Receiver<OperationTask>>>) {
    loop {
        let task = {
            let receiver = tasks.lock().unwrap();
            receiver.recv()
        };
        let Ok(task) = task else {
            return;
        };
        let mut output = vec![0u8; task.output_capacity.max(1)];
        let mut output_len = 0usize;
        let mut status = unsafe {
            (task.invoke)(
                task.input.as_ptr(),
                task.input.len(),
                output.as_mut_ptr(),
                task.output_capacity,
                &mut output_len,
            )
        };
        if output_len > task.output_capacity {
            status = -EOVERFLOW;
            output_len = 0;
        }
        output.truncate(output_len);
        let mut state = task.cell.state.lock().unwrap();
        *state = match *state {
            OperationState::CancelRequested => OperationState::CancelledDrained,
            OperationState::Pending => OperationState::Completed {
                status,
                output: Some(output),
            },
            _ => continue,
        };
        task.cell.changed.notify_all();
    }
}

#[cfg(feature = "operation-bridge")]
fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, i32> {
    bytes
        .get(offset..offset + 4)
        .and_then(|slice| slice.try_into().ok())
        .map(u32::from_le_bytes)
        .ok_or(-EINVAL)
}

#[cfg(feature = "operation-bridge")]
fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, i32> {
    bytes
        .get(offset..offset + 8)
        .and_then(|slice| slice.try_into().ok())
        .map(u64::from_le_bytes)
        .ok_or(-EINVAL)
}

#[cfg(feature = "operation-bridge")]
fn state_code(state: &OperationState) -> u8 {
    match state {
        OperationState::Pending => 0,
        OperationState::Completed { .. } => 1,
        OperationState::CancelRequested => 2,
        OperationState::CancelledDrained => 3,
        OperationState::Claimed => 4,
    }
}

#[cfg(feature = "operation-bridge")]
fn operation_reply(writer: &mut impl Write, status: i32, output: &[u8]) -> Result<(), String> {
    writer
        .write_all(&status.to_le_bytes())
        .and_then(|()| writer.write_all(&(output.len() as u32).to_le_bytes()))
        .and_then(|()| writer.write_all(output))
        .and_then(|()| writer.flush())
        .map_err(|error| error.to_string())
}

#[cfg(feature = "operation-bridge")]
fn operation_command(
    boundary: &NativeBoundary,
    tasks: &mpsc::SyncSender<OperationTask>,
    operations: &mut BTreeMap<u64, OperationRecord>,
    next_operation: &mut u64,
    input: &[u8],
) -> (i32, Vec<u8>) {
    let Some(command) = input.first().copied() else {
        return (-EINVAL, Vec::new());
    };
    match command {
        8 => {
            if input.len() < 9 {
                return (-EINVAL, Vec::new());
            }
            let Ok(output_capacity) = read_u32(input, 1).map(|value| value as usize) else {
                return (-EINVAL, Vec::new());
            };
            let Ok(timeout) = read_u32(input, 5) else {
                return (-EINVAL, Vec::new());
            };
            let payload = &input[9..];
            if payload.len() > boundary.descriptor.limits.max_input_bytes
                || output_capacity > boundary.descriptor.limits.max_output_bytes
            {
                return (-EINVAL, Vec::new());
            }
            let Some(token) = next_operation.checked_add(1).map(|next| {
                let current = *next_operation;
                *next_operation = next;
                current
            }) else {
                return (-EOVERFLOW, Vec::new());
            };
            let cell = Arc::new(OperationCell {
                state: Mutex::new(OperationState::Pending),
                changed: Condvar::new(),
            });
            let task = OperationTask {
                invoke: boundary.invoke,
                input: payload.to_vec(),
                output_capacity,
                cell: cell.clone(),
            };
            if tasks.try_send(task).is_err() {
                return (-EBUSY, Vec::new());
            }
            let state = cell.state.lock().unwrap();
            let (mut state, result) = cell
                .changed
                .wait_timeout_while(state, Duration::from_millis(timeout as u64), |state| {
                    matches!(state, OperationState::Pending)
                })
                .unwrap();
            if result.timed_out() && matches!(*state, OperationState::Pending) {
                *state = OperationState::CancelRequested;
                return (-ETIMEDOUT, Vec::new());
            }
            let OperationState::Completed { status, output } = &mut *state else {
                return (-EBUSY, Vec::new());
            };
            let Some(bytes) = output.take() else {
                return (-EALREADY, Vec::new());
            };
            let mut result = Vec::with_capacity(12 + bytes.len());
            result.extend_from_slice(&token.to_le_bytes());
            result.extend_from_slice(&status.to_le_bytes());
            result.extend_from_slice(&bytes);
            (0, result)
        }
        1 => {
            if operations.len() >= MAX_OPERATIONS {
                return (-EBUSY, Vec::new());
            }
            let Ok(output_capacity) = read_u32(input, 1).map(|value| value as usize) else {
                return (-EINVAL, Vec::new());
            };
            let payload = &input[5..];
            if payload.len() > boundary.descriptor.limits.max_input_bytes
                || output_capacity > boundary.descriptor.limits.max_output_bytes
            {
                return (-EINVAL, Vec::new());
            }
            let Some(token) = next_operation.checked_add(1).map(|next| {
                let current = *next_operation;
                *next_operation = next;
                current
            }) else {
                return (-EOVERFLOW, Vec::new());
            };
            let cell = Arc::new(OperationCell {
                state: Mutex::new(OperationState::Pending),
                changed: Condvar::new(),
            });
            let task = OperationTask {
                invoke: boundary.invoke,
                input: payload.to_vec(),
                output_capacity,
                cell: cell.clone(),
            };
            if tasks.try_send(task).is_err() {
                return (-EBUSY, Vec::new());
            }
            operations.insert(token, OperationRecord { cell });
            (0, token.to_le_bytes().to_vec())
        }
        2 | 3 | 4 | 5 | 6 | 7 => {
            let Ok(token) = read_u64(input, 1) else {
                return (-EINVAL, Vec::new());
            };
            if (command == 6) {
                let Some(record) = operations.get(&token) else {
                    return (-EBADF, Vec::new());
                };
                let releasable = matches!(
                    *record.cell.state.lock().unwrap(),
                    OperationState::Claimed | OperationState::CancelledDrained
                );
                if !releasable {
                    return (-EBUSY, Vec::new());
                }
                operations.remove(&token);
                return (0, Vec::new());
            }
            if command == 7 {
                if input.len() != 13 {
                    return (-EINVAL, Vec::new());
                }
                let timeout = u32::from_le_bytes(input[9..13].try_into().unwrap());
                let Some(record) = operations.get(&token) else {
                    return (-EBADF, Vec::new());
                };
                let state = record.cell.state.lock().unwrap();
                let (mut state, result) = record
                    .cell
                    .changed
                    .wait_timeout_while(state, Duration::from_millis(timeout as u64), |state| {
                        matches!(
                            state,
                            OperationState::Pending | OperationState::CancelRequested
                        )
                    })
                    .unwrap();
                if result.timed_out()
                    && matches!(
                        *state,
                        OperationState::Pending | OperationState::CancelRequested
                    )
                {
                    return (-ETIMEDOUT, Vec::new());
                }
                let settled = match &mut *state {
                    OperationState::Completed { status, output } => {
                        let Some(bytes) = output.take() else {
                            return (-EALREADY, Vec::new());
                        };
                        let mut result = Vec::with_capacity(4 + bytes.len());
                        result.extend_from_slice(&status.to_le_bytes());
                        result.extend_from_slice(&bytes);
                        Ok(result)
                    }
                    OperationState::CancelledDrained => Err(-125),
                    _ => Err(-EBUSY),
                };
                drop(state);
                operations.remove(&token);
                return match settled {
                    Ok(output) => (0, output),
                    Err(status) => (status, Vec::new()),
                };
            }
            let Some(record) = operations.get_mut(&token) else {
                return (-EBADF, Vec::new());
            };
            match command {
                2 => {
                    let state = record.cell.state.lock().unwrap();
                    (0, vec![state_code(&state)])
                }
                3 => {
                    if input.len() != 13 {
                        return (-EINVAL, Vec::new());
                    }
                    let timeout = u32::from_le_bytes(input[9..13].try_into().unwrap());
                    let state = record.cell.state.lock().unwrap();
                    let (state, result) = record
                        .cell
                        .changed
                        .wait_timeout_while(state, Duration::from_millis(timeout as u64), |state| {
                            matches!(
                                state,
                                OperationState::Pending | OperationState::CancelRequested
                            )
                        })
                        .unwrap();
                    if result.timed_out()
                        && matches!(
                            *state,
                            OperationState::Pending | OperationState::CancelRequested
                        )
                    {
                        (-ETIMEDOUT, Vec::new())
                    } else {
                        (0, vec![state_code(&state)])
                    }
                }
                4 => {
                    let mut state = record.cell.state.lock().unwrap();
                    if matches!(*state, OperationState::Pending) {
                        *state = OperationState::CancelRequested;
                        (0, Vec::new())
                    } else {
                        (-EALREADY, Vec::new())
                    }
                }
                5 => {
                    let mut state = record.cell.state.lock().unwrap();
                    let OperationState::Completed { status, output } = &mut *state else {
                        return (-EBUSY, Vec::new());
                    };
                    let Some(bytes) = output.take() else {
                        return (-EALREADY, Vec::new());
                    };
                    let backend_status = *status;
                    *state = OperationState::Claimed;
                    let mut result = Vec::with_capacity(4 + bytes.len());
                    result.extend_from_slice(&backend_status.to_le_bytes());
                    result.extend_from_slice(&bytes);
                    (0, result)
                }
                _ => unreachable!(),
            }
        }
        _ => (-EINVAL, Vec::new()),
    }
}

#[cfg(feature = "operation-bridge")]
fn run_operation_session(descriptor_path: &Path) -> Result<(), String> {
    let boundary = NativeBoundary::load(descriptor_path)?;
    let (task_sender, task_receiver) = mpsc::sync_channel(MAX_OPERATIONS);
    let task_receiver = Arc::new(Mutex::new(task_receiver));
    let workers = (0..MAX_OPERATIONS)
        .map(|_| {
            let task_receiver = task_receiver.clone();
            thread::spawn(move || run_operation_worker(task_receiver))
        })
        .collect::<Vec<JoinHandle<()>>>();
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = stdin.lock();
    let mut writer = stdout.lock();
    let mut operations = BTreeMap::new();
    let mut next_operation = 1u64;
    loop {
        let mut length_bytes = [0u8; 4];
        match reader.read(&mut length_bytes[..1]) {
            Ok(0) => {
                if operations.is_empty() {
                    drop(task_sender);
                    for worker in workers {
                        worker
                            .join()
                            .map_err(|_| "operation worker panicked".to_string())?;
                    }
                    return Ok(());
                }
                eprintln!("operation session closed with live operations; quarantining process");
                std::process::exit(2);
            }
            Ok(1) => reader
                .read_exact(&mut length_bytes[1..])
                .map_err(|error| error.to_string())?,
            Ok(_) => unreachable!(),
            Err(error) => return Err(error.to_string()),
        }
        let input_len = u32::from_le_bytes(length_bytes) as usize;
        if input_len > boundary.descriptor.limits.max_input_bytes + 13 {
            return Err("operation session input limit".into());
        }
        let mut input = vec![0u8; input_len];
        reader
            .read_exact(&mut input)
            .map_err(|error| error.to_string())?;
        let (status, output) = operation_command(
            &boundary,
            &task_sender,
            &mut operations,
            &mut next_operation,
            &input,
        );
        operation_reply(&mut writer, status, &output)?;
    }
}

fn run() -> Result<(), String> {
    let arguments: Vec<String> = env::args().collect();
    match arguments.as_slice() {
        [_, mode, descriptor] if mode == "--session" => run_session(Path::new(descriptor)),
        #[cfg(feature = "operation-bridge")]
        [_, mode, descriptor] if mode == "--operation-session" => {
            run_operation_session(Path::new(descriptor))
        }
        [_, descriptor, input, output] => {
            run_once(Path::new(descriptor), Path::new(input), Path::new(output))
        }
        _ => Err(
            "usage: native-linux <descriptor.json> <input.bin> <output.bin> | native-linux --session <descriptor.json> | native-linux --operation-session <descriptor.json>"
                .into(),
        ),
    }
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
