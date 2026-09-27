#[cfg(not(target_os = "macos"))]
compile_error!("the Apple Simulator supervisor boundary executor must target macOS");

use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::env;
use std::ffi::{CStr, CString, c_char, c_int, c_void};
use std::fs;
use std::path::{Path, PathBuf};

const RTLD_NOW: c_int = 2;
const RTLD_LOCAL: c_int = 4;

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

fn run() -> Result<(), String> {
    let arguments: Vec<String> = env::args().collect();
    let [_, descriptor_name, input_name, output_name] = arguments.as_slice() else {
        return Err(
            "usage: native-apple-simulator <descriptor.json> <input.bin> <output.bin>".into(),
        );
    };
    let descriptor_path = Path::new(descriptor_name);
    let descriptor: Descriptor =
        serde_json::from_slice(&fs::read(descriptor_path).map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;
    if descriptor.schema != "wasmc.native-boundary-descriptor/v1" {
        return Err("unsupported descriptor schema".into());
    }
    if descriptor.identity.is_empty() {
        return Err("missing exact Lib identity".into());
    }
    let input = fs::read(input_name).map_err(|error| error.to_string())?;
    if input.len() > descriptor.limits.max_input_bytes {
        return Err("input limit".into());
    }
    let adapter_path = canonical_adapter(descriptor_path, &descriptor.adapter.path)?;
    let adapter_bytes = fs::read(&adapter_path).map_err(|error| error.to_string())?;
    if hex_sha256(&adapter_bytes) != descriptor.adapter.sha256 {
        return Err("adapter identity mismatch".into());
    }
    let library_name = CString::new(adapter_path.as_os_str().as_encoded_bytes())
        .map_err(|_| "invalid adapter path")?;
    let symbol_name =
        CString::new(descriptor.adapter.export.as_bytes()).map_err(|_| "invalid adapter export")?;
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
    let mut output = vec![0u8; descriptor.limits.max_output_bytes];
    let mut output_len = 0usize;
    let status = unsafe {
        invoke(
            input.as_ptr(),
            input.len(),
            output.as_mut_ptr(),
            output.len(),
            &mut output_len,
        )
    };
    if output_len > output.len() {
        return Err("adapter returned invalid output length".into());
    }
    if status != 0 {
        return Err(format!("adapter failed with status {status}"));
    }
    output.truncate(output_len);
    fs::write(output_name, &output).map_err(|error| error.to_string())?;
    println!(
        "{}",
        serde_json::json!({
            "accepted": true,
            "schema": "wasmc.lib-defined-apple-simulator-supervisor/v1",
            "identity": descriptor.identity,
            "adapter_sha256": descriptor.adapter.sha256,
            "input_bytes": input.len(),
            "output_bytes": output.len()
        })
    );
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
