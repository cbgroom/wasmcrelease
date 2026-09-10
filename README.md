# wasmc release channel

Source-free public packages for the private-source `wasmc` compiler.

Current release: `v0.0.8`. It adds the engine-neutral `wasmc-core-runtime`
Rust SDK for Wasmi-first completion, optional Wasmtime promotion, and
compile-free Core module inspection. Its SDK source is byte-bound to private
authority `bddf8a371698ac7f1ced87b02952df5be5359dad`. The established v0.0.4
compatibility trees and the v0.0.7 Runtime compiler remain byte-for-byte
unchanged.

GitHub Actions continuously exercises the public repository as a source-free consumer: staged deployment, Node/Bun/Deno compile and execution, JavaScript examples, Lib package contracts, and Rust/Wasmtime Component behavior. It does not build, replace, or admit canonical compiler/Lib bytes; immutable release publication remains a separate maintainer-controlled process.

- Agents and developers: [AGENTS.md](AGENTS.md)
- Language delta: [LANGUAGE.md](LANGUAGE.md)
- Lib model and managed collections: [LIB.md](LIB.md)
- JavaScript, raw Wasm, and Wasmtime: [HOSTING.md](HOSTING.md)
- Runtime/Registry bootstrap: [runtime/README.md](runtime/README.md)
- Wasmi + Wasmtime Core Runtime SDK: [sdk/wasmc-core-runtime/README.md](sdk/wasmc-core-runtime/README.md)
- Release history: [RELEASES.md](RELEASES.md)

## JavaScript context

A checked-out source-free release uses the checked-in facade directly:

```js
import { compile, inspectWasm } from "./dist/wasmc.mjs";
```

Only an application that has explicitly installed or resolved the package uses:

```js
import { compile, inspectWasm } from "@wasmc/compiler";
```

These are explicit contexts, not fallback probes. Repository-local use does not require npm or another external JavaScript registry.

Production consumers must pin `v0.0.8` or its full commit and verify `SHA256SUMS`. `main` and latest metadata are mutable discovery conveniences.
