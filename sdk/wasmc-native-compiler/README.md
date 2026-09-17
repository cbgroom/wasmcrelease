# Native WAsmC CLI integration glue (development)

This public source-free Rust CLI consumes the admitted `current/wasmc_compiler.wasm`; it contains no compiler source and never rebuilds compiler/CoreLib Wasm. During each platform build, `build.rs` verifies the admitted compiler digest and derives a target-local Wasmtime AOT image for the compiler. That `.cwasm` is a build derivative only; the checked-in Core Wasm remains the portable authority.

The user model is deliberately small:

```text
wasmc run INPUT.wasmc [scalar-arg ...]
    compiler AOT -> App Core Wasm -> Wasmi

wasmc build INPUT.wasmc -o OUTPUT.wasm
    compiler AOT -> portable App Core Wasm

wasmc build --target native INPUT.wasmc -o EXECUTABLE
    compiler AOT -> App Core Wasm -> Wasmtime AOT cache -> standalone executable
```

`run` is fixed to Wasmi for low cold-start overhead. It does not expose a runtime selector. Native build is the explicit high-performance deployment path. The generated executable contains target-local Wasmtime AOT bytes and can execute directly without the `wasmc` CLI. Native cache entries are rebuildable derivatives keyed by App Wasm identity, Wasmtime version, target, CPU feature set and AOT profile; delete the cache at any time and rebuild from the portable Wasm authority.

`Compiler::new(Limits)` creates an exclusive resident compiler instance from the build-time AOT derivative. Source/output size, linear memory and per-operation fuel remain bounded. Compiler bootstrap is independent from the per-compilation fuel budget; a trap or failed cleanup poisons the instance and callers must construct a new one rather than replaying an uncertain operation.

The current v1 CLI runs/builds import-free scalar Apps directly. CoreLib/Lib publication remains standard Core Wasm and is not duplicated as a native package format. Existing public Host/CoreLib composition work remains separate from this initial CLI/native packaging slice.

## Build and use

```bash
cargo +1.96.0 build --release --locked --manifest-path sdk/wasmc-native-compiler/Cargo.toml
sdk/wasmc-native-compiler/target/release/wasmc run examples/agent-start/01_add.wasmc 5 6
sdk/wasmc-native-compiler/target/release/wasmc build examples/agent-start/01_add.wasmc -o /tmp/add.wasm
sdk/wasmc-native-compiler/target/release/wasmc build --target native examples/agent-start/01_add.wasmc -o /tmp/add
/tmp/add 5 6
```

The CLI refuses existing outputs. File writing is not claimed to be power-loss durable. Wasmtime serialized modules are target/configuration caches, never portable package identity.

## Cross-platform qualification

GitHub Actions builds this same source-free CLI on six desktop targets:

| OS | Targets | Runner |
|---|---|---|
| Linux | x86_64 / aarch64 GNU | ubuntu-24.04 / ubuntu-24.04-arm |
| macOS | x86_64 / aarch64 | macos-15-intel / macos-14 |
| Windows | x86_64 / aarch64 MSVC | windows-2025 / windows-11-arm |

Each package contains `wasmc`, this README, Cargo.lock and a manifest binding the exact public source commit, target, compiler digest, toolchain, runtime roles and file hashes. A downloaded-consumer job re-verifies the package and reruns byte-parity, Wasmi `run`, native build/direct execution and no-clobber checks without rebuilding the CLI.

Actions artifacts are development CI outputs, not immutable release assets. Existing release tags remain unchanged until an explicitly authorized promotion retains the already-qualified bytes rather than rebuilding them.
