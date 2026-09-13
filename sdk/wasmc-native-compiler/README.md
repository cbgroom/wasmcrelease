# Native compiler integration glue (development)

This public Rust SDK/CLI executes the admitted, import-free compiler Wasm.
It contains no compiler source. Compiler digest is checked at construction;
Actions compile only this integration glue, never compiler/CoreLib artifacts.
The crate is independent of the frozen Runtime SDK and uses Wasmi2 only.

```
cargo build --release --locked --manifest-path sdk/wasmc-native-compiler/Cargo.toml
sdk/wasmc-native-compiler/target/release/wasmc-wasmi compile INPUT.wasmc OUTPUT.wasm
```

`Compiler::new(Limits)` creates an exclusive resident instance; reuse it for
multiple sources. Outputs are copied before cleanup. Source/output size,
linear memory and per-operation fuel are bounded. Fuel is not a wall-clock
deadline. Traps poison the instance; create a new one, do not silently retry.
The CLI refuses existing outputs. File writing is not atomic or power-loss
durable. Scalar compiler ABI only: automatic managed planning/Lib compile,
generated-program execution, explicit Host binding, inspect/serve commands,
dual-engine promotion and Android/iOS packaging remain subsequent work.

Actions execute Rust tests, strict Clippy, JS byte-parity, generated-program
execution and no-clobber checks on all six native desktop targets:

| OS | Targets | Runner |
|---|---|---|
| Linux | x86_64 / aarch64 GNU | ubuntu-24.04 / ubuntu-24.04-arm |
| macOS | x86_64 / aarch64 | macos-15-intel / macos-14 |
| Windows | x86_64 / aarch64 MSVC | windows-2025 / windows-11-arm |

Each package contains the executable, this README, Cargo.lock and manifest.json
(full public source commit, target, profile, compiler digest, toolchain, file
sizes/SHA-256). Downloaded packages are reverified and executed on fresh native
jobs, without rebuilding; nine mutation tests reject source/profile/target/
compiler drift, false stability, missing/extra/tampered files. Select the exact
source-bound artifact in the workflow run, extract it, and verify with:

```
node scripts/native-package.mjs verify EXTRACTED TARGET FULL_SOURCE_COMMIT
```

This command needs Node26 and the matching public source checkout for the
independent JS behavior oracle; it runs no Cargo build. Hashes establish
consistency, not signatures or publisher authenticity. Actions artifacts are
retained CI outputs, not permanent immutable release assets. Formal release
must retain these tested bytes instead of rebuilding at promotion.

Uploaded artifacts are development CI outputs, not formal signed
release manifests or proof of mobile support. Existing immutable release
products/tags are unchanged. Wasmi cannot run Std1.4's fast artifact requiring
function references/tail calls; no automatic compatibility fallback is claimed.

Delivery plan: Wasmi-only SDK/CLI first; Wasmi+Wasmtime future-stateless-call
promotion second; full target manifests and dev/main/prod qualification third.
Mobile library packaging follows real target execution and embedding evidence.
