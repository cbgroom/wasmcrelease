# Mobile targets: compile proof is not runtime proof

Mutable public Host/glue only. Default reference dependency graph is Wasmi2,
without Wasmtime/WASI, system TLS or hidden JIT. Explicit optional Wasmtime is
qualified separately on desktop runners, never enabled as mobile fallback.

Rust1.96 locked default `host/tests/e2e/rust` all-target checks cover:

- aarch64-apple-ios
- aarch64-apple-ios-sim
- aarch64-linux-android
- aarch64-unknown-linux-ohos

The mandatory Action mobile-compile matrix verifies compilation and absence of
Wasmtime/WASI/TLS/WAT dependencies. Inventory checks use portable fail-closed
grep, require exact root/Wasmi entries and reject empty/incomplete inventories;
twenty controls prevent missing tools/files or inspection errors becoming PASS.
Preserved older missing-rg CI failure is not acceptance. It does not link/sign/install a native artifact,
execute an iOS simulator or phone, validate entitlements/local-network permission,
JNI/N-API/App embedding, shutdown races, throughput or power-loss behavior.
Browser raw UDP/TCP remains unavailable. Full Std1.4 function-reference/tail-call
requirements are not made portable by compiling this Wasmi reference.

```sh
rustup target add aarch64-apple-ios --toolchain 1.96.0
cargo +1.96.0 check --locked --manifest-path host/tests/e2e/rust/Cargo.toml --target aarch64-apple-ios --all-targets
```

Replace target with the other listed names. Local iOS/Android/OHOS checks passed;
exact-source matrix acceptance and main integration remain pending. Actual mobile
SDK artifacts and device/runtime proof belong to later explicit delivery gates.
