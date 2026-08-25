# WAsmC public Agent entrypoint

This is the source-free public distribution of WAsmC. Start here when you need
to write a WAsmC program or embed the compiler. The immutable current release
is `v0.0.2`; pin that tag or its full commit, not `main` or `latest`.

## Pick your task

| Task | Start here | Current status |
|---|---|---|
| Write scalar/control-flow/Core-lane WAsmC | [Language guide](LANGUAGE.md), then `node examples/agent-start/run.mjs` | Shipped and executable |
| Compile from JavaScript/TypeScript | [JavaScript Host path](HOSTING.md#javascript) | Shipped |
| Embed raw compiler Core Wasm | [Raw compiler ABI](HOSTING.md#raw-compiler-abi) | Shipped |
| Integrate from Rust/Wasmtime | [Rust demo](examples/rust-wasmtime) | Executable demo, not an SDK |
| Use `string`, `list<T>`, maps, or managed objects from new source | [FastAPI availability](FASTAPI.md) | Not available in `v0.0.2` |
| Maintain this public repository | [Maintainer bootstrap](.agents/MAINTAINERS.md) | Maintainer-only guidance |

Do not infer the language from Rust alone. WAsmC uses a WIT-shaped declaration
shell and Rust-familiar executable expressions, but it is not full Rust.

## Run before changing anything

```bash
node examples/agent-start/run.mjs
```

Expected: five `PASS` lines. This compiles the checked-in programs with the
published compiler, verifies imports, instantiates the output, and checks exact
results. Then copy the nearest `.wasmc` example and change one behavior at a time.

## Smallest complete program

```wasmc
package local:add;

interface api {
  run: func(a: s32, b: s32) -> s32 {
    return a + b * 2;
  }
}

world app { export api; }
```

Compile and run it in JavaScript:

```js
import { compile, inspectWasm } from "./dist/wasmc.mjs";

const wasm = await compile(source);
const inspected = inspectWasm(wasm);
if (inspected.imports.length !== 0) throw new Error("unexpected authority");
const instance = await WebAssembly.instantiate(inspected.module, {});
console.log(instance.exports.run(5, 6)); // 17
```

## `v0.0.2` capability contract

| Capability | Availability | Public proof |
|---|---|---|
| `package`, `interface`, `world`, exported functions | Shipped | numbered examples |
| fixed-width scalars, expressions, locals, assignment | Shipped | examples 01-03 |
| `if`, `while`, `break`, `continue`, `return` | Shipped | example 02 |
| private top-level functions | Shipped | example 03 |
| Core-lane record/tuple/option/result/variant/enum values | Shipped; Host sees flattened lanes | language guide + compiler |
| explicit Host function imports | Shipped; Host must authorize | example 05 |
| standard Core Wasm output | Shipped | JS and Rust journeys |
| FastAPI Core Provider 4.3 bytes and metadata | Shipped provider only | Rust provider validation/init |
| general managed-source compile/link (`string`, lists, maps, objects) | Not shipped | no public facade entrypoint or end-to-end example |
| automatic Component Model or JS object lifting | Not shipped | Core Wasm facade only |

“Provider shipped” does not mean “managed source is usable.” In `v0.0.2`, the
public facade does not export `compileFastapi`, and there is no supported
general managed caller builder. Do not guess provider calls, handles, layouts,
nonces, activation plans, or lifecycle operations. See `FASTAPI.md`.

## Immutable selection and integrity

1. Resolve the full public commit for the selected immutable tag.
2. Fetch every file from that tag or commit.
3. Verify selected files against `SHA256SUMS` and `manifest.json`.
4. Keep compiler, facade, FastAPI provider, metadata, and examples together.

```text
https://cdn.jsdelivr.net/gh/cbgroom/wasmcrelease@<TAG_OR_FULL_COMMIT>/<PATH>
```

`package-index.json.latest`, `main`, and unversioned CDN URLs are mutable
discovery pointers. Version `0.0.x` is released but not API-stable.

## Authority rule

Generated programs request external authority only through their Wasm imports.
Inspect the full import set and bind only reviewed functions. Never invent
filesystem, network, clock, entropy, process, environment, secret, database,
or device access merely because an application could use it.

## Handoff contract

Report the exact tag/commit, compiler and provider hashes, complete source,
generated imports/exports, Host bindings, behavior test that ran, and any
untested browser/deployment/performance/compatibility scope. Do not call the
Rust demo an SDK or a provider-init test a managed-source product test.
