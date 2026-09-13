---
name: release-host-integration
description: Maintain wasmc JavaScript, raw Core Wasm, Lib Component, Rust, and Wasmtime integration guidance with exact imports, lifecycle, version, and behavior evidence.
---

# Release Host integration

## Integration layers

- JavaScript facade is the default Node/browser-family consumer path.
- Raw compiler Core Wasm is the portable ABI path for other hosts.
- The Rust project is executable Wasmtime reference code, not an SDK crate.
- `lib_core.wasm` is the matching managed-value Core provider; standalone Libs
  additionally publish WIT-authoritative Core and Component views.

Choose the smallest layer that satisfies the caller. Do not add a wrapper when
copyable reference code exposes the contract more clearly.

## Host authority and lifecycle

- Inspect every generated program import and bind only explicitly authorized functions.
- Compiler adapter buffers are instance-local mutable state; use exclusive
  access, copy results before clear, and clear on success and failure.
- Reuse Wasmtime Engine/Module compilation where appropriate, but use a fresh
  bounded Store for independent requests.
- Keep compiler, Libs, metadata, and facade from one release identity.
- Treat Wasmtime serialized modules as target/toolchain/configuration caches,
  never as the portable package identity.

## Evidence

Diagnose feature incompatibility from complete artifact validation and minimal
executable probes, not target_features metadata or the first byte-offset error.
Bind contracts to exact artifact digests; distinguish Core capabilities from
JavaScript Host globals. Tested exact engines are not minimum-version guarantees.
Check identity and engine support before instantiation; probe success never
replaces full-module validation. Follow-up tooling must not pretend it was
shipped inside an older immutable tag or alter strict Lib root inventories.

Validate the actual public files and record exact tag/commit, hashes, imports,
Host policy, behavior result, and untested scope. A module that validates, a
Lib that initializes, and a source program that links are distinct claims.
