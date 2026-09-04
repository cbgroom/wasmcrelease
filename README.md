# wasmc release channel

Source-free public packages for the private-source `wasmc` compiler.

Current release: `v0.0.6`. It closes the Fresh-Agent optimization flywheel at 100/100 without rewriting the established compatibility surface: the v0.0.4 `dist/`, `package/`, and `libs/` trees remain byte-for-byte frozen, while the current Runtime/Registry gains compiler-owned structured diagnostics, finite recordless managed planning through the current Runtime compiler, and same-candidate live Node/Bun/Deno evidence. GitHub Actions is not part of the release path.

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

Production consumers must pin `v0.0.6` or its full commit and verify `SHA256SUMS`. `main` and latest metadata are mutable discovery conveniences.
