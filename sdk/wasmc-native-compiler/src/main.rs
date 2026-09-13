use std::{env, fs, process};
use wasmc_native_compiler::{Compiler, Limits};
fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        process::exit(1);
    }
}
fn run() -> Result<(), String> {
    let args: Vec<_> = env::args().collect();
    if args.len() != 4 || args[1] != "compile" {
        return Err(
            "usage: wasmc-wasmi compile INPUT.wasmc OUTPUT.wasm (scalar compiler profile)".into(),
        );
    }
    let limits = Limits::default();
    if fs::metadata(&args[2]).map_err(|e| e.to_string())?.len() > limits.source_bytes as u64 {
        return Err("source limit exceeded".into());
    }
    let source = fs::read_to_string(&args[2]).map_err(|e| e.to_string())?;
    let bytes = Compiler::new(limits)?.compile(&source)?;
    // Never clobber an existing product, including symlinks.
    use std::io::Write;
    let mut output = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&args[3])
        .map_err(|e| e.to_string())?;
    output.write_all(&bytes).map_err(|e| e.to_string())
}
