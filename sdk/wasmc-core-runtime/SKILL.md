---
name: wasmc-core-runtime-sdk
description: Embed the public dual-engine Core Wasm runtime SDK in Rust with exact import admission, Wasmi-first completion, bounded async Wasmtime preparation, promotion/rollback, limits, cancellation, and no replay.
parent_skill: wasmc-sdk-discovery
---

# wasmc-core-runtime SDK

Use this when a Rust application wants WAsmC/Core Wasm **engine mechanics** but
will own Host capability/admission policy itself.

The current component map marks this SDK `published` and immutable v0.0.12
contains it. Still verify the exact pinned tag/full commit before use; a newer
checkout may carry a different qualified revision.

## Minimal route

1. Construct `CoreRuntimeSdkConfig`.
2. For untrusted or production guest execution, set an explicit
   `CoreRuntimeLimitProfile`; the config constructor/default begins with an
   unbounded limit profile.
3. Call `inspect_core` when admission needs exact imports/exports/signatures.
4. Prepare one exact artifact with `prepare_core` or the matching reviewed
   Host-import preparation API.
5. Invoke immediately. The completion route is Wasmi until a faster route has
   been explicitly admitted.
6. Optionally call `request_optimization` to enqueue bounded asynchronous
   Wasmtime preparation.
7. Observe `artifact.status()` or `wait_for_optimization`. A completed
   compile is a candidate, not automatically a selected backend.
8. Call `artifact.publish(decision)` only after the embedding Host has positive
   behavior/resource evidence. Future fresh invocations may then use Wasmtime.
9. Use `rollback_to_completion` to route future calls back to Wasmi.

An invocation already executing is never migrated. A selected-backend trap or
Host-side failure is never retried on the other backend.

## Verify this checkout

```bash
cargo +1.96.0 test --locked --manifest-path sdk/wasmc-core-runtime/Cargo.toml --test runtime_sdk
```

Expected public entrypoints include `CoreRuntimeSdk`,
`CoreRuntimeSdkConfig`, `CoreRuntimeArtifact`, `request_optimization`,
`publish`, cancellation, and exact import/limit types. Do not invent
`WasmtimeHostSdk` or other historical wrapper names.
