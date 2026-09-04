# wasmc Runtime / Registry — public v0.0.6 surface

This directory carries the current source-free Runtime/Registry path for public `v0.0.6`.

The primary package is `wasmc-runtime-v0/`:

```bash
cd wasmc-runtime-v0
node bootstrap.mjs self-test
node bootstrap.mjs compile --input examples/add.wasmc --output /tmp/add.wasm
```

It contains the current import-free Core compiler plus thin Node, Bun, and Deno Host adapters. It requires no npm or external JavaScript package registry. The exact v0.0.6 product candidate was independently executed from one source-free Runtime archive under Node, Bun, and Deno; each Host passed self-test, compilation, WebAssembly validation, instantiation, and the same behavior oracle. The receipts in `wasmc-runtime-v0/receipts/` bind those runs to the product candidate, compiler digest, archive identity, Host identity, and runtime version.

`registry-v0/` is repo-local resolver/channel/mirror metadata for `wasmc:runtime@0.1.0-runtime-v0`. Its internal `dev` label is resolver metadata, not the public update channel. The immutable outer `v0.0.6` tag/full commit is publication authority.

Current compiler identity:

```text
bytes   1487329
sha256  44b87828c2b5b01631066cf1a2bc1246534f6d97a741a111437cd39caeb884f9
```

The v0.0.4 `dist/`, `package/`, and `libs/` compatibility trees remain byte-frozen. When a managed source needs the v0.0.6 compiler capability while using the established facade, pass this Runtime compiler through the documented `compilerWasmBytes` option rather than replacing compatibility bytes.

Verify the package `manifest.json`, `receipts/compiler-wasm.json`, Host receipts, and repository `SHA256SUMS` before use.
