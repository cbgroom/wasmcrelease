# Libs

Use a WIT lib for mutable or identity-bearing String/List/Map/record/resource
work and reusable pure algorithms. Write ordinary typed source; never generate
private lib calls or plan bytes.

## Write ordinary managed source

```wasmc
package local:orders;
interface api {
  record Item { sku: string, price: s32 }
  count: func() -> u32 {
    let mut items: list<Item> = list.new();
    items.push({ sku: "book", price: 5 });
    let mut totals: map<string,s32> = map.new();
    totals.insert("book", 12);
    return items.len() + totals.len();
  }
}
world app { export api; }
```

The compiler derives the finite managed type graph from this same ordinary
parse. Reuse Rust expectations for `String`, `List`, `Map`, and pure algorithms,
then check the released WIT for the exact supported subset. In `.wasmc`, WIT
kebab-case names are written as snake_case. Do not import private helpers or
create and expose implementation handles.

## Choose one facade

- `instantiateLib(source)` is the default runnable authority-free path. It
  verifies, links, initializes, and returns a standard `WebAssembly.Instance`.
- `compileLib(source)` returns `{appWasm, libWasm}` when the caller needs to
  retain or embed the exact artifacts.
- `compileLib(source, explicitPlan)` is reserved for reviewed external resource
  libs whose effects, failure adapters, bindings, package identity, or authority
  cannot be derived safely from declared WIT.

### Source-free repository checkout

From the root of a checked-out source-free release, import the checked-in ESM
facade directly. This route requires no package installation or external
JavaScript registry.

```js
import { instantiateLib } from "./dist/wasmc.mjs";
const instance = await instantiateLib(source);
const count = instance.exports.count();
```

### Installed package

Use the package name only when the application environment has explicitly
installed or otherwise resolved `@wasmc/compiler`.

```js
import { instantiateLib } from "@wasmc/compiler";
const instance = await instantiateLib(source);
const count = instance.exports.count();
```

These are two paths to the same public facade, not fallback guesses. Do not use
the package import merely because a source-free checkout contains a
`package.json`, and do not use the repository-relative path from an unrelated
application directory.

Never manually initialize a bundled lib when the facade can do it. Internal
exports, Store nonces, reference lanes, lifecycle calls, and activation plans
are embedding details, not application vocabulary.

## Compose explicit Host functions

For synchronous scalar Host functions, pass a nested WebAssembly imports object
to `instantiateLib`. V0 Host lanes are bool, s32, u32, s64, f32, or f64;
managed values and async effects do not cross this boundary.

```js
const instance = await instantiateLib(source, {
  imports: { host: { add_one: value => value + 1 } },
});
```

The source must declare `host.add_one` in an imported interface, but calls it as
`add_one(value)`. Missing, extra, non-callable, lib-owned, or wrong-signature
bindings fail closed. A valid binding still does not grant any other authority.
Files, network, clocks, randomness, credentials, and devices remain separate
application-owned Host adapters.

Managed references remain local to one initialized instance/Store. Never
persist them, send them between Stores, or treat a terminal trap or cleanup
failure as recoverable without an exact contract.
