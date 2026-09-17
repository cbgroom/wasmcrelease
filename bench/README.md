# Public native CLI benchmark corpus

This directory is the public, source-level performance corpus for the native `wasmc` CLI. The five `.wasmc` inputs are copied byte-for-byte from the accepted compiler performance corpus; `manifest.json` freezes source size/SHA-256 and expected generated Core Wasm size/SHA-256.

The corpus is deliberately independent of compiler implementation source. A public checkout plus the admitted `compiler.wasm` and the open native CLI glue is enough to reproduce it.

Measured command paths:

```text
wasmc run SOURCE [args]                  -> compiler AOT -> Core Wasm -> Wasmi
wasmc build SOURCE -o APP.wasm           -> portable Core Wasm
wasmc build --target native SOURCE -o APP
                                            -> local Wasmtime AOT cache -> standalone APP
./APP [args]                              -> execute embedded AOT image directly
```

All five cases measure portable build plus native cache miss/hit. `small_scalar` additionally has an execution oracle (`5 6 -> 17`) and therefore measures `run`/Wasmi and standalone native execution. More execution oracles may be added only by extending the versioned manifest; do not silently reinterpret an existing case.

GitHub-hosted runner timings are comparative observations, not absolute performance SLAs. Hard gates are: exact benchmark source identity, exact expected generated Wasm identity, successful compilation, native cache semantics, and declared behavior oracles. Timing regressions are retained in history and become hard thresholds only after repeated cross-runner evidence establishes a stable policy.

Local reproduction after building the public CLI:

```bash
cargo +1.96.0 build --release --locked --manifest-path sdk/wasmc-native-compiler/Cargo.toml
node scripts/native-cli-perf.mjs sdk/wasmc-native-compiler/target/release/wasmc local result.json
```

The six-platform workflow is `.github/workflows/native-cli-perf.yml`. A successful `main` run publishes `latest.json`, `history.json`, Markdown/HTML summaries and Shields-compatible badge JSON to the `perf-data` branch.
