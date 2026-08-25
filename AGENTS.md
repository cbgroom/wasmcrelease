# WAsmC agent guide

This repository is the public, source-free distribution channel for WAsmC.
Use this file when an agent needs to integrate the compiler or explain its
current capabilities. The private compiler repository remains the build and
language authority; do not infer missing semantics from these binary packages.

If you need to write WAsmC source, read `LANGUAGE.md` first and then run
`node examples/agent-start/run.mjs`. Do not infer the language from Rust alone.

## Choose the smallest integration

- JavaScript, TypeScript, Node.js, Bun, Deno, or a browser: use
  `dist/wasmc.mjs` with `dist/wasmc_compiler.wasm` beside it.
- Rust native/server code: start from `examples/rust-wasmtime`. It uses plain
  Wasmtime and is executable reference code, not a published WAsmC SDK crate.
- Another WebAssembly host: embed `dist/wasmc_compiler.wasm` and implement the
  compiler ABI described below.
- Managed records, strings, lists, maps, options, results, or variants: also
  use the exact `dist/fastapi_core.wasm` and `dist/fastapi_core.json` shipped in
  the same candidate. Do not mix provider bytes from another version.

## Integrity and version selection

The current formal initial-development release is `v0.0.2`. Before consuming
any release:

1. Resolve and record the full 40-character public Git commit.
2. Fetch files from that commit, never from `main`, `latest`, or a version
   range when immutable bytes matter.
3. Verify every selected file against `SHA256SUMS` and `manifest.json`.
4. Keep compiler, JavaScript facade, FastAPI Core, and metadata from one commit.

The jsDelivr form is:

```text
https://cdn.jsdelivr.net/gh/cbgroom/wasmcrelease@<FULL_COMMIT>/<PATH>
```

`package-index.json.latest` is a mutable discovery pointer. Its selected entry
in `versions` identifies the immutable tag. Version `0.0.x` is formally
released but not API-stable; do not turn `latest` into a compatibility claim.

## JavaScript entrypoint

The facade exports `createCompiler`, `compile`, `compilePackage`,
`flattenWasmcPackage`, `inspectWasm`, `loadFastApiCoreBytes`, and
`FASTAPI_CORE_URL`.

```js
import { compile } from "./dist/wasmc.mjs";

const source = `package local:add;
interface api {
  run: func(a: s32, b: s32) -> s32 { return a + b * 2; }
}
world app { export api; }
`;

const wasm = await compile(source);
const { instance } = await WebAssembly.instantiate(wasm, {});
console.log(instance.exports.run(5, 6)); // 17
```

`compilePackage(files)` sorts `{name, source}` entries by UTF-8 file name,
concatenates their source, and performs an ordinary compilation. Despite its
name, it does not currently construct or link a FastAPI product bundle.

## Raw compiler ABI

The compiler is import-free standard Core Wasm. A host must provide a fresh or
otherwise exclusively owned instance while compiling because adapter buffers
are instance-local mutable state.

Required exports:

```text
memory
wasmc_alloc(len: i32) -> i32
wasmc_compile(ptr: i32, len: i32) -> i32
wasmc_output_ptr() -> i32
wasmc_output_len() -> i32
wasmc_error_ptr() -> i32
wasmc_error_len() -> i32
wasmc_clear()
```

Write UTF-8 source into the allocation returned by `wasmc_alloc`. A compile
status of zero means the output pointer and length identify generated standard
Core Wasm. A nonzero status identifies a UTF-8 diagnostic. Copy output or error
bytes before calling `wasmc_clear`, and call `wasmc_clear` on every path.

Generated programs declare their own import requirements. Review the complete
import set and bind only explicitly authorized host functions before
instantiation. Never invent filesystem, network, clock, entropy, process,
secret, or device authority merely because an application could use it.

## FastAPI Core boundary

`dist/fastapi_core.wasm` is FastAPI Core Provider 4.3.0. It is an import-free,
pure-compute managed-value heap and lifetime provider. Its metadata and exact
Core signatures are in `dist/fastapi_core.json`.

The provider is not a network API, HTTP framework, ambient host service, or
general source compiler. A managed caller must be built for the exact provider
contract, linked explicitly in the same Store, initialized in the required
order, and retired with that Store. The Rust demo validates the public provider
and calls `provider_domain_init(domain, store_nonce)`; it does not yet compile a
general managed source into a linked product bundle.

Until a formal public managed-source entrypoint is published, an agent must
either use a reviewed prebuilt managed caller supplied by its application or
state that managed product construction is not available through this public
preview. Do not silently substitute private tooling or hard-coded examples.

## Rust and Wasmtime

Run the complete reference project with:

```bash
cd examples/rust-wasmtime
cargo run --locked
cargo test --locked
```

The lockfile pins Wasmtime 47.0.3. Reuse `Engine` and compiled `Module` values,
but create a fresh bounded `Store` for each independent request. Keep import
allowlists explicit. Wasmtime serialized/AOT artifacts are target-, version-,
and configuration-bound caches; portable `.wasm` remains the package identity.

## When generating an integration

An agent should report:

- the exact public commit or immutable tag;
- compiler and FastAPI SHA-256 identities;
- selected host and explicit import policy;
- whether the path is ordinary compilation or a prebuilt managed caller;
- the behavior test that actually ran;
- any unvalidated browser, deployment, performance, or compatibility scope.

Prefer a small copyable integration over a new abstraction. Do not call the
Rust demo an SDK, claim source availability, add a hidden runtime layer, or
describe an initial-development release as API-stable.

## Editing this distribution repository

This repository cannot rebuild the compiler. Changes to public packages must
come from the private clean synchronized source authority and pass its release
admission. Documentation-only changes must still update `manifest.json` when
the changed file is an artifact and regenerate `SHA256SUMS` for every listed
file. Never add private source, private paths, maintainer state, credentials,
GitHub Actions as a required build path, or mutable production CDN examples.
