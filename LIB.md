# wasmc Libs

`lib` is the public reusable-compute layer. WIT owns public identity and signatures. A Lib may implement pure algorithms in Core Wasm or forward explicit effects to the Host without changing the Core caller vocabulary.

For ordinary managed String/List/Map/record applications, write typed wasmc source and use `instantiateLib(source)`. The compiler derives the finite graph and selects the matching bundled Lib; Agents must not construct handles or activation plans.

The established v0.0.4 facade bytes remain frozen in v0.0.6. Record-backed applications therefore retain their old default behavior. To use v0.0.6 finite **recordless** String/List/Map planning from a source-free repository checkout, bind the current Runtime compiler through the facade's existing compiler override:

```js
import { readFile } from "node:fs/promises";
import { instantiateLib } from "./dist/wasmc.mjs";

const compilerWasmBytes = await readFile("./runtime/wasmc-runtime-v0/compiler.wasm");
const instance = await instantiateLib(source, { compilerWasmBytes });
console.log(instance.exports.run());
```

Browser or other hosts supply the same verified Runtime compiler bytes through `compilerWasmBytes`; acquiring those bytes remains application policy. The compiler-internal finite managed roots are not a public plan vocabulary and cannot be injected by caller-pinned JSON plans.

Standalone packages demonstrate the boundary:

- `libs/wasmc-owned-algorithms`: strings, scalar lists, and flat records through reviewed pure Rust algorithms.
- `libs/wasmc-resource-counter`: a stateful WIT resource with constructor, receiver methods, and drop lifecycle.
- `libs/wasmc-host-clock`: a Component that requests exactly one Host function.

Each directory is a self-describing Skill rooted at `SKILL.md` and carries authoritative `lib.wit`, `lib.json`, fast-path `artifact.wasm`, and standard `component.wasm`. Read that Skill before use.

To build a reviewed Rust Lib, follow [skills/wasmc-developer/references/authoring-libs.md](skills/wasmc-developer/references/authoring-libs.md). The compact profile covers free functions and the documented value subset; `wit-bindgen-component` covers resources/methods and explicit imports. Async, traits, open generics, and automatic Rust API discovery are unsupported.
