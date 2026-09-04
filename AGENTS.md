# wasmc public Agent entrypoint

This source-free repository publishes standard Core Wasm compiler, Lib packages, and a package-manager-free Runtime/Registry bootstrap. The current immutable release is `v0.0.6`; pin that tag or its full commit for reproducible use.

## Start here

Read [skills/wasmc-developer/SKILL.md](skills/wasmc-developer/SKILL.md) completely. It routes only the reference needed for Runtime bootstrap, source/WIT, Lib authoring, JavaScript, or Rust/Wasmtime. Reuse Rust and WIT priors and learn only the documented wasmc delta.

```wasmc
package local:add;
interface api {
  run: func(a: s32, b: s32) -> s32 { return a + b * 2; }
}
world app { export api; }
```

```js
import { compile, inspectWasm } from "./dist/wasmc.mjs";
const bytes = await compile(source);
const inspected = inspectWasm(bytes);
if (inspected.imports.length) throw new Error("unexpected Host authority");
const instance = await WebAssembly.instantiate(inspected.module, {});
console.log(instance.exports.run(5, 6)); // 17
```

## v0.0.6 capability contract

| Task | Status | Canonical path |
|---|---|---|
| Package-manager-free compile/self-test on Node/Deno/Bun | shipped; Node+Bun+Deno same-candidate evidenced | [runtime/README.md](runtime/README.md), `runtime/wasmc-runtime-v0` |
| Scalars, control flow, private functions, WIT values | shipped | [LANGUAGE.md](LANGUAGE.md) |
| Managed String/List/Map/record applications | shipped through matching Lib | [LIB.md](LIB.md), `instantiateLib` |
| Build a reviewed Rust crate as a WIT Lib | shipped locally | developer Skill authoring reference |
| WIT resources, constructors, receiver methods | shipped Component profile | `libs/wasmc-resource-counter` |
| Explicit synchronous scalar Host imports | shipped; exact allowlist | `libs/wasmc-host-clock` |
| JavaScript, raw Core Wasm, Rust/Wasmtime | shipped | [HOSTING.md](HOSTING.md) |
| async Libs, traits, open generics, automatic Rust API discovery | unsupported | do not invent a bridge |
| signing, auto-update, ambient filesystem/network/device access | not provided | application/publisher authority |

The v0.0.4 `dist/`, `package/`, and `libs/` compatibility trees remain byte-for-byte frozen. v0.0.6 advances only the additive Runtime/Registry, Agent guidance, and evidence surface; it does not silently rebuild or replace those established compatibility bytes.

## Artifact selection

- `dist/wasmc.mjs`: self-contained ESM facade.
- `dist/wasmc.global.js`: classic `globalThis.Wasmc` facade.
- `dist/wasmc_compiler.wasm`: import-free compiler Core Wasm.
- `package/`: sidecar package with compiler, matching `lib_core.wasm`, and developer Skill.
- `libs/*/`: Core/Component, WIT, metadata, and root `SKILL.md` per Lib.
- `examples/rust-wasmtime/`: locked executable reference project, not an SDK.
- `runtime/wasmc-runtime-v0/`: current `compiler.wasm` plus thin universal/Node/Bun/Deno Host adapters; no npm or external JS registry.
- `runtime/registry-v0/`: repo-local resolver/channel/mirror metadata for `wasmc:runtime`.

Inspect every generated import and bind only reviewed Host functions. Never expose private handles, plans, Store nonces, lifecycle helpers, or JSON invented as a WIT replacement.

```text
https://cdn.jsdelivr.net/gh/cbgroom/wasmcrelease@v0.0.6/<PATH>
```

Verify files against `SHA256SUMS`, `manifest.json`, and `release.json`. `main`, unversioned URLs, and `package-index.json.latest` are mutable discovery state.
