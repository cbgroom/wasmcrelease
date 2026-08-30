# wasmc Libs

`lib` is the public reusable-compute layer; there is no FastAPI compatibility name in `v0.0.4`. WIT owns public identity and signatures. A Lib may implement pure algorithms in Core Wasm or forward explicit effects to the Host without changing the Core caller vocabulary.

For ordinary managed String/List/Map/record applications, write typed wasmc source and use `instantiateLib(source)`. The compiler derives the finite graph and selects the matching bundled Lib; Agents must not construct handles or activation plans.

```js
import { instantiateLib } from "./dist/wasmc.mjs";
const instance = await instantiateLib(source);
console.log(instance.exports.count());
```

Standalone packages demonstrate the boundary:

- `libs/wasmc-owned-algorithms`: strings, scalar lists, and flat records through reviewed pure Rust algorithms.
- `libs/wasmc-resource-counter`: a stateful WIT resource with constructor, receiver methods, and drop lifecycle.
- `libs/wasmc-host-clock`: a Component that requests exactly one Host function.

Each directory is a self-describing Skill rooted at `SKILL.md` and carries authoritative `lib.wit`, `lib.json`, fast-path `artifact.wasm`, and standard `component.wasm`. Read that Skill before use.

To build a reviewed Rust Lib, follow [skills/wasmc-developer/references/authoring-libs.md](skills/wasmc-developer/references/authoring-libs.md). The compact profile covers free functions and the documented value subset; `wit-bindgen-component` covers resources/methods and explicit imports. Async, traits, open generics, and automatic Rust API discovery are unsupported.
