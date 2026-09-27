#[cfg(not(target_os = "linux"))]
compile_error!("the native Linux boundary executor must be built on Linux");

use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::env;
use std::ffi::{CStr, CString, c_char, c_int, c_void};
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

const RTLD_NOW: c_int = 2;
const RTLD_LOCAL: c_int = 0;

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

fn run() -> Result<(), String> {
    let arguments: Vec<String> = env::args().collect();
    match arguments.as_slice() {
        [_, mode, descriptor] if mode == "--session" => run_session(Path::new(descriptor)),
        [_, descriptor, input, output] => {
            run_once(Path::new(descriptor), Path::new(input), Path::new(output))
        }
        _ => Err(
            "usage: native-linux <descriptor.json> <input.bin> <output.bin> | native-linux --session <descriptor.json>"
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
