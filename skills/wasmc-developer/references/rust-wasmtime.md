# Rust and Wasmtime

Compile once, review the complete Core import set, cache one Engine and Module,
and use a fresh bounded Store per invocation. Populate the Linker only with
approved functions; fuel, epoch, and memory policy stay caller-owned.

## Standard Wasmtime path

```rust
use wasmtime::{Engine, Linker, Module, Store};

let engine = Engine::default();
let module = Module::from_binary(&engine, &wasm)?;
assert!(module.imports().next().is_none());
let mut store = Store::new(&engine, AppState::default());
let linker = Linker::new(&engine);
let instance = linker.instantiate(&mut store, &module)?;
let run = instance.get_typed_func::<(i32, i32), i32>(&mut store, "run")?;
assert_eq!(run.call(&mut store, (3, 4))?, 11);
```

For imports, compare every module/name/kind/signature against an exact policy,
then bind only those functions with `Linker::func_wrap`. Keep credentials,
quotas, handles, cancellation, and audit state in `Store<AppState>`. A matching
signature is not an authority grant.

## WAsmC Core Runtime SDK

For reusable dual-engine mechanics, use the actual public
`sdk/wasmc-core-runtime` surface:

- `CoreRuntimeSdk::inspect_core` for exact imports/exports/signatures without
  synchronously compiling Wasmtime;
- `prepare_core` or the matching reviewed Host-import preparation function for
  one exact artifact and policy fingerprint;
- artifact invocation for the immediate Wasmi completion path;
- `CoreRuntimeSdk::request_optimization` for bounded asynchronous Wasmtime
  preparation;
- `artifact.status()` / `wait_for_optimization` to observe compilation;
- `artifact.publish(decision)` for explicit Host-admitted promotion;
- `rollback_to_completion` for future-call fallback without replay.

`CoreRuntimeSdkConfig::default()` starts with an **unbounded**
`CoreRuntimeLimitProfile`. Production/untrusted embedding should construct a
complete bounded profile for engine fuel, wall clock, linear memory, table
elements, and concurrent Stores.

A completed Wasmtime compile is only a candidate. It does not automatically
become the selected route; positive behavior/resource evidence remains
Host-owned. An invocation already selected on one backend is never retried on
the other after a trap or uncertain effect.

When the Rust application also needs generic Resource registration and OS-aware
binding policy, route through `sdk/wasmc-host` **if the pinned release surface
admits it**. `WasmcHost::native`, `native_strict`, and
`WasmcHost::builder` are the current public Host SDK entrypoints.

Direct `wasmtime run` is useful for reviewed no-import development examples;
production code should embed the Wasmtime API or the Core Runtime SDK. Never share a
Store-local lib reference between Stores or threads.
