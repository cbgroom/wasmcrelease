# wasmc Libs

`lib` is the public reusable-compute layer. WIT owns public identity and signatures. A Lib may implement pure algorithms in Core Wasm or forward explicit effects to the Host without changing the Core caller vocabulary.

For ordinary managed String/List/Map/record applications, write typed wasmc source and use `instantiateLib(source)`. The compiler derives the finite graph and selects the matching bundled Lib; Agents must not construct handles or activation plans.

A managed `map<K,V>` is a resident/local value, not a direct public return
shape. WIT has no native Map. When a public contract needs a copied snapshot,
return an explicit `list<Entry<K,V>>` or use a declared resource; direct public
Map is rejected rather than silently serialized.

The v0.0.21 current facade embeds the same verified compiler as the Runtime
package. Use the facade directly for supported ordinary managed source:

```js
import { instantiateLib } from "./current/wasmc.mjs";
const instance = await instantiateLib(source);
console.log(instance.exports.run());
```

Explicit raw compiler acquisition is application policy. The compiler derives
finite managed roots; caller-pinned JSON plans are not application source.

Begin reusable-compute discovery with
[the Library-first Skill](skills/wasmc-lib-discovery/SKILL.md) and the exact
[current catalog](catalog/libs-current-v2.json). It describes42 complete Roots,
236 exported API routes and278 index entries. Read the selected Root's own
`SKILL.md`, `lib.wit` and `lib.json`; use its declared SDK paths and verify its
full manifest/inventory before installation. Core, Component and native-source
profiles have separate contracts. Fourteen native-source identities remain
source-only. The73-API Std1.4.1 contract is available at
[its complete Root](standard/wasmc-std/1.4.1/).

System Telemetry offers a generated Component resource SDK. Its ordinary source
resource-method route remains unsupported. A declared Host import requests an
effect and does not grant authority; supply an exact application-owned allowlist
and a bounded adapter. Channel receipts decide public release and installation
states; product presence and local qualification do not decide them.

To build a reviewed Rust Lib, follow [skills/wasmc-developer/references/authoring-libs.md](skills/wasmc-developer/references/authoring-libs.md). The compact profile covers free functions and the documented value subset; `wit-bindgen-component` covers resources/methods and explicit imports. Async, traits, open generics, and automatic Rust API discovery are unsupported.
