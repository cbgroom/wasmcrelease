# Hosting wasmc v0.0.5

Choose the smallest standard layer that fits the caller.

## Runtime package — preferred for new compile-only Agents

No npm install is required:

```bash
cd runtime/wasmc-runtime-v0
node bootstrap.mjs self-test
node bootstrap.mjs compile --input examples/add.wasmc --output /tmp/add.wasm
```

The same package shape has Bun and Deno adapters. Node and Deno are release-evidenced; Bun remains an adapter contract until a Bun-capable host is available for independent live validation. Verify `manifest.json` and `receipts/compiler-wasm.json` before activation. The repo-local resolver metadata is under `runtime/registry-v0`.

The internal registry's `dev` label is package-local resolver metadata. The outer immutable `v0.0.5` Git tag is the public release identity.

## JavaScript

```js
import { compile, compileLib, instantiateLib, inspectWasm } from "./dist/wasmc.mjs";
```

`compile` emits standard Core Wasm. `compileLib` returns matching application and Lib bytes. `instantiateLib` is the default managed-value path and returns an ordinary `WebAssembly.Instance`. The facade also exports `compilePackage`, `compileDetailed`, `flattenWasmcPackage`, and `createCompiler`; see [skills/wasmc-developer/references/javascript.md](skills/wasmc-developer/references/javascript.md).

The classic file exposes the same surface as `globalThis.Wasmc`. Browser fetch policy, Workers, CORS, CSP, caching, and permissions remain application decisions.

## Raw compiler ABI

`dist/wasmc_compiler.wasm` is import-free Core Wasm. It exports `memory`, `wasmc_alloc`, `wasmc_compile`, output/error pointer and length accessors, and `wasmc_clear`. Adapter buffers are instance-local mutable state: use exclusive access, copy output before clear, and clear success and failure paths.

## Rust and Wasmtime

```bash
cd examples/rust-wasmtime
cargo test --locked
cargo run --locked
```

The demo compiles and executes scalar source, invokes a stateful resource Component, and binds the one explicit `clock-host.now` import. It is copyable reference code, not a published SDK. Reuse Engine/compiled modules where appropriate and create a fresh bounded Store for independent requests.

Generated imports are authority requests. Reject unknown modules/functions/signatures; no release file grants ambient filesystem, network, clock, randomness, credentials, process, or device access.
