# JavaScript

## Direct Core compilation

```js
import { compile, inspectWasm } from "@wasmc/compiler";
const wasm = await compile(source);
const inspected = inspectWasm(wasm);
console.table(inspected.imports);
const instance = await WebAssembly.instantiate(inspected.module, approvedImports);
```

Build `approvedImports` from an application-owned exact allowlist. Reject
unknown modules, functions, kinds, or signatures before instantiation. For a
no-import module, pass `{}` and assert the inspected import set is empty.

The package exposes:

- `compile(source)` for one logical source;
- `compilePackage([{name, source}, ...])` for deterministic multi-file source;
- `flattenWasmcPackage(files)` to recover the canonical single source;
- `compileDetailed(source)` for structured success or diagnostics;
- `inspectWasm(bytes)` for the compiled module and import/export inventory;
- `compileLib` and `instantiateLib` for managed values and WIT libs;
- `createCompiler()` when an isolated reusable compiler instance is required.

Use `try/finally` and `compiler.dispose()` for a compiler created explicitly.
The shared `compile` helpers reuse a default compiler internally.

## Package and CLI

```text
node cli.mjs input.wasmc output.wasm
```

The JS CLI is compiler-only and accepts exactly input and output paths. Use the
ESM API for package flattening, structured diagnostics, inspection, libs,
or custom compiler bytes. The emitted bytes are standard Core Wasm.

## Browser boundary

The ESM API works with browser-native `WebAssembly`; the classic distribution
exposes the equivalent `globalThis.Wasmc` facade. Fetching compiler/provider
bytes, Workers, CORS, CSP, origins, caching, and browser permissions remain
application policy. Successful local instantiation is not a deployment or
authority claim.

For managed code, follow `lib.md` and prefer
`instantiateLib(source, options)`. Do not add a JSON bridge for WIT values,
reconstruct lib-owned imports, or expose private managed references to JS.
