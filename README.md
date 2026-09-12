# wasmc release channel

Source-free public packages for the private-source `wasmc` compiler.

Current release: `v0.0.9`, built from exact private source
`e69abb73f667f3810b0c40937fd1a1e2d04d4255`. Use `current/` for the
latest compiler facade; `dist/`, `package/`, and `libs/` are frozen v0.0.4
compatibility trees, not current compiler entrances. The Wasmi/Wasmtime
Core Runtime SDK remains available in `sdk/wasmc-core-runtime`.

This candidate covers bit operations, managed collection loops, stable minimal
String paths, and the 73-function `wasmc:std@1.4.0` source-free standard Lib.
The standard Lib is reused from its qualified producer, not rebuilt here.
See [current examples](examples/current/standard.wasmc) and run
`node scripts/validate-current.mjs` and `node examples/current/standard.mjs`
(Bun and Deno are also supported). These deterministic tests are not the
original external 114-entry evaluation or a fresh LLM-generated benchmark.

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
import { compile, inspectWasm } from "./current/wasmc.mjs";
```

Only an application that has explicitly installed or resolved the package uses:

```js
import { compile, inspectWasm } from "@wasmc/compiler";
```

These are explicit contexts, not fallback probes. Repository-local use does not require npm or another external JavaScript registry.

Consumers must pin `v0.0.9` or its full commit and verify `SHA256SUMS`.
`main` and latest metadata are mutable discovery conveniences.
