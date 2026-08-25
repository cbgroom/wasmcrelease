---
name: release-host-integration
description: Maintain WAsmC JavaScript, raw Core Wasm, Rust and Wasmtime integration guidance with exact imports, lifecycle, version, and behavior evidence.
---

# Release Host integration

## Integration layers

- JavaScript facade is the default Node/browser-family consumer path.
- Raw compiler Core Wasm is the portable ABI path for other hosts.
- The Rust project is executable Wasmtime reference code, not an SDK crate.
- FastAPI Core is an import-free managed-value provider, not a network API or
  automatic managed-source product builder.

Choose the smallest layer that satisfies the caller. Do not add a wrapper when
copyable reference code exposes the contract more clearly.

## Host authority and lifecycle

- Inspect every generated program import and bind only explicitly authorized functions.
- Compiler adapter buffers are instance-local mutable state; use exclusive
  access, copy results before clear, and clear on success and failure.
- Reuse Wasmtime Engine/Module compilation where appropriate, but use a fresh
  bounded Store for independent requests.
- Keep compiler, provider, metadata, and facade from one release identity.
- Treat Wasmtime serialized modules as target/toolchain/configuration caches,
  never as the portable package identity.

## Evidence

Validate the actual public files and record exact tag/commit, hashes, imports,
Host policy, behavior result, and untested scope. A module that validates, a
provider that initializes, and a source program that links are distinct claims.
