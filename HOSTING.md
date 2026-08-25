# Hosting WAsmC

Choose the smallest public layer that fits the caller. All paths produce or
consume standard Core Wasm; none grant ambient Host authority.

## JavaScript

Use `dist/wasmc.mjs` in Node.js, Bun, Deno, browsers, or TypeScript projects.
Keep `dist/wasmc_compiler.wasm` beside the facade, or pass an explicit immutable
compiler URL to `createCompiler`.

The `v0.0.2` facade exports:

```text
FASTAPI_CORE_METADATA_URL  FASTAPI_CORE_URL
WasmcBrowserCompiler       createCompiler
compile                    compilePackage
flattenWasmcPackage        inspectWasm
loadFastApiCoreBytes       loadWasmcBrowserCompiler
main
```

```js
import { compile, inspectWasm } from "./dist/wasmc.mjs";

const wasm = await compile(source);
const inspected = inspectWasm(wasm);
const imports = inspected.imports.map(({ module, name }) => `${module}.${name}`);
if (imports.length !== 0) throw new Error(`unexpected imports: ${imports}`);
const instance = await WebAssembly.instantiate(inspected.module, {});
```

`compilePackage(files)` sorts `{name, source}` entries by UTF-8 filename,
concatenates the sources, and performs ordinary compilation. It is not a module
system, linker, or FastAPI product-bundle builder.

## Raw compiler ABI

`dist/wasmc_compiler.wasm` is import-free standard Core Wasm. Its adapter
buffers are instance-local mutable state, so compile with a fresh or otherwise
exclusively owned instance.

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

Write UTF-8 source into the allocation from `wasmc_alloc`. Status zero means
the output pointer/length identify generated Wasm; nonzero means the error
pointer/length identify a UTF-8 diagnostic. Copy the selected bytes before
`wasmc_clear`, and clear on every success and failure path.

## Rust and Wasmtime

The executable reference project is `examples/rust-wasmtime`:

```bash
cd examples/rust-wasmtime
cargo run --locked
cargo test --locked
```

It pins Wasmtime 47.0.3, compiles WAsmC source through the public compiler,
executes the result, and validates/initializes the matching FastAPI provider.
It is demo source, not a published SDK crate.

Reuse `Engine` and compiled `Module` values when appropriate. Create a fresh,
bounded `Store` for each independent request and keep import allowlists
explicit. Serialized/AOT Wasmtime artifacts are target-, Wasmtime-version-,
and configuration-bound caches; portable `.wasm` remains package identity.

## FastAPI

The public FastAPI provider has a separate lifecycle and contract. Loading or
initializing it does not link a generated program. Read `FASTAPI.md` before
claiming managed-source support.
