# wasmc release channel

Source-free public packages for the private-source `wasmc` compiler.

Current release: `v0.0.7`. It advances the additive Runtime compiler to the exact aggregate-semantic baseline while preserving the established compatibility surface: the v0.0.4 `dist/`, `package/`, and `libs/` trees remain byte-for-byte frozen. The release has source-free same-candidate Node/Bun/Deno evidence and Fresh-Agent 100/100.

GitHub Actions continuously exercises the public repository as a source-free consumer: staged deployment, Node/Bun/Deno compile and execution, JavaScript examples, Lib package contracts, and Rust/Wasmtime Component behavior. It does not build, replace, or admit canonical compiler/Lib bytes; immutable release publication remains a separate maintainer-controlled process.

- Agents and developers: [AGENTS.md](AGENTS.md)
- Language delta: [LANGUAGE.md](LANGUAGE.md)
- Lib model and managed collections: [LIB.md](LIB.md)
- JavaScript, raw Wasm, and Wasmtime: [HOSTING.md](HOSTING.md)
- Runtime/Registry bootstrap: [runtime/README.md](runtime/README.md)
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

Production consumers must pin `v0.0.7` or its full commit and verify `SHA256SUMS`. `main` and latest metadata are mutable discovery conveniences.
