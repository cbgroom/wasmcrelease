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

## wasmc convenience SDK

`WasmtimeHostSdk` verifies exact Core imports and current lib bundles. It
offers two bounded lanes:

- `prepare_module` plus `invoke` for a reviewed Core module and exact
  `WasmtimeHostImport` descriptors;
- `prepare_lib_bundle` plus `invoke_lib` for an exact current lib
  product bundle.

Each invocation creates a fresh bounded Store. Supply explicit
`WasmtimeHostLimits` for memory, instances, tables, fuel, and epoch deadline.
Treat import-policy, binding, bundle-identity, invocation, protocol, or cleanup
errors as fail-closed outcomes and retire the Store.

The SDK does not authorize application capabilities, own framework state,
select pooling/publication policy, or establish hostile multi-tenant safety.
Use Wasmtime directly when the application needs a different Store topology.

Direct `wasmtime run` is useful for reviewed no-import development examples;
production code should embed the Wasmtime API or the bounded SDK. Never share a
Store-local lib reference between Stores or threads.
