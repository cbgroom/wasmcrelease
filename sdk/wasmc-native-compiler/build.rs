use std::{env, fs, path::PathBuf};

use sha2::{Digest, Sha256};
use wasmtime::{Config, Engine, OptLevel};

const COMPILER_SHA256: &str = "93d946c544975a6e7642ff1f5890e09d3bfb9924d0256ffcfebcf07485597c90";

fn main() {
    let manifest = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("manifest dir"));
    let target = env::var("TARGET").expect("Cargo TARGET");
    println!("cargo:rustc-env=WASMC_TARGET_TRIPLE={target}");
    let compiler = manifest.join("../../current/wasmc_compiler.wasm");
    println!("cargo:rerun-if-changed={}", compiler.display());
    let wasm = fs::read(&compiler).expect("read admitted compiler.wasm");
    assert_eq!(
        format!("{:x}", Sha256::digest(&wasm)),
        COMPILER_SHA256,
        "public compiler.wasm digest drifted"
    );

    // This is target-local derivation only. The checked-in Core Wasm remains
    // the public/release authority; compiler.cwasm is never admitted as a
    // portable artifact.
    let mut config = Config::new();
    config.cranelift_opt_level(OptLevel::Speed);
    config.consume_fuel(true);
    // An explicitly configured target disables host-inferred CPU features in
    // Wasmtime. The embedded compiler AOT therefore targets the architecture
    // baseline selected by the GitHub Actions matrix rather than the specific
    // runner CPU. Local App native builds remain free to specialize for the
    // user's actual CPU.
    config
        .target(&target)
        .expect("configure compiler AOT target");
    let engine = Engine::new(&config).expect("create build-time Wasmtime engine");
    let cwasm = engine
        .precompile_module(&wasm)
        .expect("AOT compile admitted compiler.wasm");
    let out = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR"));
    fs::write(out.join("compiler.cwasm"), cwasm).expect("write target-local compiler AOT");
}
