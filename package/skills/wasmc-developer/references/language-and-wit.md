# Language and WIT

## Smallest complete program

```wasmc
package local:demo;
interface host { double: func(value: s32) -> s32; }
interface api { run: func(value: s32) -> s32 { return double(value); } }
world app { import host; export api; }
```

Every complete source declares a package, at least one interface, and one world.
A function without a body is an import declaration; a function with a body is
implemented locally. The world selects imported and exported interfaces. Call
an imported function directly as `double(value)`, never `host.double(value)`.

Use snake_case in `.wasmc`. The compiler maps public WIT identities to
kebab-case while keeping current Core ABI names distinct. Do not put kebab-case
in executable source because `-` is subtraction.

## Source organization

Use one `.wasmc` file for a small program. For a large program, pass one
directory containing complete top-level `.wasmc` units with deterministic
numeric names such as `00-package.wasmc`, `10-types.wasmc`, and
`90-world.wasmc`. The directory still forms one logical package and one Core
Wasm module. There is no `mod`, `use`, or `include` syntax.

## Canonical language subset

- Prefer fixed-width scalars. Use `s32` for ordinary integer computation and
  `u32` for sizes and indices. Convert an integer expression to `f64`
  explicitly with `as f64`.
- Use `let`, bounded `let mut`, `if`, `while`, `break`, `continue`, `return`,
  and exhaustive `match`. There is no canonical `for` or iterator syntax.
- Construct `option<T>` with `some(value)` or `none()` and `result<T,E>` with
  `ok(value)` or `err(error)`.
- Construct tuples with `tuple(...)`; construct records with named fields;
  construct variants with `variant.case(...)`.
- Define reusable private scalar helpers as top-level `fn`. Ordinary source
  cannot declare generics; use concrete types.

Bind a call, constructor, or conditional result to a typed local before using
receiver methods or matching if its shape would otherwise be ambiguous.

```wasmc
package local:decide;
interface api {
  record Point { x: s32, y: s32 }
  score: func(point: Point, enabled: bool) -> result<s32, s32> {
    if (!enabled) { return err(-1); }
    let total: s32 = point.x + point.y;
    return ok(total);
  }
}
world app { export api; }
```

## Compile and inspect

```text
wasmc input.wasmc output.wasm
wasmc --wit contract.wit input.wasmc output.wasm
wasmc --emit-wit input.wasmc output.wit
wasmc --trace-abi-json input.wasmc
wasmc --json-errors input.wasmc
wasmc --run input.wasmc run 3 4
```

When a WIT contract is supplied, fix `.wasmc` parse/type errors before WIT
contract mismatches. Validate output with `wasm-tools validate`. Treat every
generated import as a capability request that must match an exact Host policy.

Do not generate raw pointers, user-defined linear memory, tuple/record
destructuring, recursive records, hidden Host calls, lib lifecycle calls,
or compiler-private handles.
