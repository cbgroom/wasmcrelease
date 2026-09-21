---
name: wasmc-host-sdk
description: Embed the generic Rust WAsmC Host SDK with OS-aware binding profiles, explicit resource grants, BindingReport auditing, and access to the Core Runtime SDK.
parent_skill: wasmc-sdk-discovery
---

# wasmc-host SDK

Use this when an existing Rust application needs the Core Runtime **plus**
generic Host resources and binding policy.

## Status first

This Skill existing in a mutable checkout does not prove the SDK belongs to the
current immutable release. Read `release.json` and `release-surfaces.json`
when present. If the surface is `candidate`, say so and pin the candidate
commit only for evaluation; do not claim an older tag shipped it.

## Choose one binding path

### OS-aware convenience

```rust
use wasmc_host::{HostBindPolicy, WasmcHost};

let host = WasmcHost::native(HostBindPolicy::Safe)?;
println!("{:?}", host.binding_report());
```

- `Minimal`: runtime only; no automatic resource authority.
- `Safe`: Minimal plus bounded scratch memory.
- `Development`: Safe plus reviewed development resources available through
  existing generic platform mechanisms.

Use `native_strict` when every expected automatic binding must succeed.

### Explicit authority

Use `WasmcHost::builder()` plus `grant_memory`,
`grant_preopened_file`, `grant_file_path`, or a custom
`ResourceBinding`. Prefer explicit grants for production authority.

## Important boundary

`HostBindPolicy::Safe` constrains **automatic Host authority**; it does not
automatically configure guest fuel, wall clock, linear-memory, table, or
concurrent-Store limits. Configure those through `CoreRuntimeSdkConfig` and
`CoreRuntimeLimitProfile` via `WasmcHostBuilder::runtime_config`.

The current SDK packages synchronous generic resource registration. Do not
invent higher-level telemetry/database/GPU Host operations or claim formal
generated guest window/read/write bindings from this SDK unless the pinned
release explicitly contains and qualifies them.

## Verify this checkout

```bash
cargo +1.96.0 test --locked --manifest-path sdk/wasmc-host/Cargo.toml
cargo +1.96.0 run --locked --manifest-path sdk/wasmc-host/Cargo.toml --example native
```
