# Writing WAsmC

This is the public language guide for an Agent that needs to write WAsmC.
WAsmC combines a WIT-shaped declaration shell, Rust-familiar expressions, and
standard Core WebAssembly output. It is not full Rust and does not use Cargo,
modules, macros, traits, references, or a borrow-checker syntax.

For `v0.0.2`, use this guide for direct Core-lane programs: scalars, control
flow, private functions, flattened structured values, and explicit Host
imports. New managed source using `string`, lists, maps, or identity-bearing
objects is not publicly buildable in this release; read `FASTAPI.md` instead
of guessing provider operations.

Start by copying a complete program, compiling it, and changing one behavior at
a time. The five numbered teaching programs are exercised by
`examples/agent-start/run.mjs`; the remaining snippets define generation rules.

## The smallest complete program

```wasmc
package local:add;

interface api {
  run: func(a: s32, b: s32) -> s32 {
    return a + b * 2;
  }
}

world app { export api; }
```

Every small program has three layers:

1. `package namespace:name;` gives the logical package identity.
2. An exported `interface` declares functions and gives them bodies.
3. A `world` names imported interfaces and exported interfaces.

Compile and execute it with the published JavaScript facade:

```js
import { compile } from "./dist/wasmc.mjs";

const wasm = await compile(source);
const { instance } = await WebAssembly.instantiate(wasm, {});
console.log(instance.exports.run(5, 6)); // 17
```

The generated artifact is standard Core Wasm. The current facade does not
produce a Component and does not automatically lift WIT records or sums into
JavaScript objects.

## Agent generation recipe

For a new program, generate in this order:

1. Choose one `package local:<name>;` declaration.
2. List external capabilities as signature-only imported interfaces.
3. Put public entrypoints with bodies in one exported `api` interface.
4. Use top-level private `fn` declarations for reusable local computation.
5. Add one `world app` that imports the required capabilities and exports
   `api`.
6. Compile. Inspect the complete Wasm import list before instantiation.
7. Bind only reviewed imports and run an exact behavior oracle.

Prefer one file. For a large generated program, use several complete `.wasmc`
files and pass them to `compilePackage([{name, source}, ...])`. File names are
sorted by UTF-8 bytes and the sources are concatenated into one logical package.
There is no `mod`, `use`, `include`, or source-import syntax.

## Declarations

### Exported function

Inside an exported interface, declare a WIT-shaped signature followed by a
body:

```wasmc
interface api {
  run: func(value: s32) -> s32 {
    return value + 1;
  }
}
```

### Private function

Private reusable functions are top-level Rust-shaped `fn` declarations:

```wasmc
fn abs(value: s32) -> s32 {
  if (value < 0) { return -value; }
  return value;
}
```

They are not exported unless called by an exported function.

### Explicit Host import

An imported capability has a signature but no body:

```wasmc
package local:host_demo;

interface host {
  double: func(value: s32) -> s32;
}

interface api {
  run: func(value: s32) -> s32 {
    return double(value) + 1;
  }
}

world app { import host; export api; }
```

Call an imported function by its declared function name: `double(value)`.
Do not write `host.double(value)`. The declaration requests authority; it does
not grant it. The embedding host must explicitly bind the exact `host.double`
Core import.

## Types

The direct public compiler supports these Core-lane type families:

```text
s8 u8 s16 u16 s32 u32 i64 f32 f64 bool
record tuple option result variant enum
```

Use fixed-width names. `s32` is the normal signed integer; `u32` is suitable
for non-negative sizes and indices. There is no target-dependent `usize`.

Put named WIT-shaped declarations inside the interface that uses them:

```wasmc
interface api {
  record point { x: s32, y: s32 }
  enum color { red, green, blue }

  sum: func(value: point) -> s32 {
    return value.x + value.y;
  }
}
```

Common value constructors are:

```wasmc

{ x: 4, y: 5 }
tuple(4, true)
some(4)
none()
ok(4)
err(-1)
variant.code(4)
variant.none
```

Structured values lower to one or more Core value lanes. A raw host therefore
sees flattened Core parameters/results, not automatic JavaScript or Rust
objects. Keep the first runnable entrypoint scalar unless the host already
knows and verifies the exact ABI.

`string`, `list<T>`, maps, identity-bearing mutable objects, and resource
methods belong to the managed FastAPI path. The public compiler facade in this
release does not construct and link a general managed-source FastAPI product bundle.
Do not guess provider calls or manipulate handles, layouts, reference counts,
Store nonces, or lifecycle plans in generated source. See `FASTAPI.md`.

## Variables and assignments

Declare local variables with explicit types:

```wasmc
let total: s32 = 0;
let enabled: bool = true;
total = total + 1;
```

Explicit types make generated programs easier to repair and audit. Scalars are
copy values. Managed owned values use Rust-familiar move-by-default semantics,
but new Agents should stay on the scalar/structured direct path until they have
a reviewed FastAPI product builder.

## Expressions

Supported familiar forms include:

```wasmc
a + b * 2
(a + b) * 2
-a
!flag
a == b
a != b
a < b
a <= b
a > b
a >= b
a && b
a || b
if (flag) { a } else { b }
helper(a, b)
```

Use parentheses around conditions. Do not emit Rust references, dereference,
closures, iterators, method chains on scalars, macros, or implicit casts.

## Control flow

Use `if`, `while`, `break`, `continue`, and `return`:

```wasmc
let total: s32 = 0;
let i: s32 = 0;

while (i < limit) {
  if (i == stop) { break; }
  total = total + i;
  i = i + 1;
}

return total;
```

`while` is the canonical loop. Do not generate `for`, ranges, iterators,
`loop`, labels, or implicit returns.

## Options, results, and variants

Construct WIT-shaped sum values explicitly:

```wasmc
find: func(key: s32) -> option<s32> {
  if (key >= 0) { return some(key * 2); }
  return none();
}

divide: func(a: s32, b: s32) -> result<s32, s32> {
  if (b == 0) { return err(-1); }
  return ok(a / b);
}
```

Match variants exhaustively and bind payloads in the arm:

```wasmc
return match value {
  none => 0,
  code(code) => code + 1,
};
```

Avoid default arms and Rust-specific `if let`, `?`, `unwrap`, or pattern
destructuring unless a selected managed profile explicitly documents them.

## Naming

Use Rust-style `snake_case` for packages, interfaces, worlds, functions,
parameters, fields, and cases. Named types may use `PascalCase`. Do not write
hyphenated source identifiers: `-` is subtraction. WAsmC owns the mapping to
canonical WIT kebab-case where required.

## What not to generate

Do not assume support for full Rust or full WIT. In particular, avoid:

- `use`, `mod`, crates, Cargo dependencies, attributes, or macros;
- structs, impl blocks, traits, generics, references, lifetimes, or `unsafe`;
- `for`, iterators, closures, async, threads, or hidden scheduling in ordinary
  first-run programs;
- implicit filesystem, network, clock, entropy, process, environment, secret,
  database, or device access;
- provider-private FastAPI functions or raw managed handles;
- automatic JavaScript object lifting for Core structured values.

If a capability is external, declare it as an imported WIT-shaped interface
and let the host decide whether to bind it.

## Compile failures

When compilation fails, repair the smallest reported construct. Common Agent
mistakes are:

- missing `package`, exported interface, or `world`;
- writing `fn run(...)` inside an interface instead of `run: func(...)`;
- giving an imported signature a body;
- calling `host.double(...)` instead of `double(...)`;
- using `for`, implicit return, Rust `match` patterns, or unsupported generics;
- expecting `compilePackage` to create a FastAPI product bundle;
- binding imports that were not present in the compiled module.

Never add an import merely to silence an error. Imports are authority requests.

## Verify before handing off

An Agent-generated integration is complete only when it reports:

- exact WAsmC release tag or full commit;
- the complete source files;
- compiler and FastAPI digests used;
- generated Wasm import/export lists;
- explicit Host bindings and limits;
- one exact behavior oracle that ran;
- unsupported or unvalidated scope.

Run the public teaching corpus with:

```bash
node examples/agent-start/run.mjs
```

That command compiles every example through the published compiler and executes
the scalar, control-flow, structured-record, private-function, and explicit
Host-import behaviors.
