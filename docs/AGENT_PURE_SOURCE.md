# Pure source: write, run, change

This small guide covers ordinary scalar and tuple programs. Choose source only
after Library-first discovery for reusable computation. Create your own `.wasmc`
file directly in the current checkout. It is expected not to exist yet;
there is no existing source file to discover before writing it. The route names
shipped, preflight-checked runner paths, so no script-directory probes are needed. For syntax outside this guide read the relevant
section of LANGUAGE.md; supported type/feature positions are decided separately.

Use a plain source package name such as `package local:basics;`. The current
compiler accepts names such as `pair_echo`, `pairEcho` and `pair2`, but rejects
`package local:pair-echo;` with `expected Semi, got Minus`. A `.wasmc` filename
may contain hyphens; it is separate from the source package identifier. Do not
copy a hyphenated filename into the package declaration.

A complete file declares a package, an interface with function bodies, and a
world exporting that interface. Parameters use WIT fixed-width types, including
`s32` and `bool`. Use `true` and `false` for boolean arguments. A function returns
exactly one semantic value. Preserve several requested values independently in
one tuple or record; boolean conjunction discards those separate values.
Determine the requested outputs before choosing expressions. When the request
is to return both parameters without a requested transformation, return
`tuple(value, flag)` as `tuple<s32, bool>`. Do not ignore `flag`, turn the s32
into a predicate, add one, or substitute two values calculated from one input.

```wasmc
package local:basics;

interface api {
  keep: func(value: s32, flag: bool) -> tuple<s32, bool> {
    return tuple(value, flag);
  }

  choose: func(value: s32, flag: bool) -> s32 {
    if (flag) { return value * 2; }
    return value;
  }
}

world app { export api; }
```

Copy a pattern, then change names, types and expressions to implement the actual
request. The sample is not an answer to a different requested computation.
If the request preserves inputs, keep the `keep` return expression unchanged;
change names only. Change arithmetic or branches only when the request asks for
that computation, as in `choose`.
Expressions include fixed-width arithmetic and comparisons. Use `if (condition)
{ ... }` and `return value;`. Public entrypoints are `name: func(...) -> type`
inside the exported interface, rather than Rust `pub fn` declarations.

The execution runner takes `--source`, `--export` and `--calls`. Calls are JSON
arrays of positional argument arrays: `[[3,true],[-1,false]]` for two parameters.
They are not objects containing an `args` property. Match the requested arguments
and exported signature. The runner checks compiler and facade digests before
importing the facade, compiles with the exact hash-checked raw compiler bytes,
inspects imports, refuses Host imports before instantiation, instantiates
with `{}`, and returns source/Core hashes plus actual results. One invocation
handles all requested calls. Report its evidence once and stop.
Optionally pass `--expected-results` with JSON of the results derived from the
request, for example `[[3,1],[3,0]]` for calls `[[3,true],[3,false]]` returning
both inputs. The runner compares actual flattened results to this caller oracle;
a mismatch fails. Each call contributes one result: bool and 32-bit/float scalar
results are JSON numbers (bool is 0/1); Core i64 results use the decimal object
described below. A tuple result is an array of flattened lanes. Thus scalar
`choose` for `[[3,true],[-1,false]]` expects `[6,-1]`, while tuple `keep` for
the same calls expects `[[3,1],[-1,0]]`. Do not wrap scalar results in extra
arrays merely because call arguments are arrays. Derive expectations from the
request, never from the program's
observed output. Compilation alone proves syntax, not the requested semantics.

## Exact 64-bit calls

Ordinary source uses `i64` for signed 64-bit integers and `u64` for unsigned
64-bit integers. The WIT signed name is `s64`; it is not the source spelling.
Both use Core i64 lanes, which require JavaScript BigInt arguments. In runner
JSON, encode each such argument or expected result as an object containing only
`bigint_decimal` with an exact decimal string. Do not pass a JSON number or
convert through Number; a JSON number cannot carry every 64-bit integer exactly.

For example, write `wide.wasmc`:

```wasmc
package local:wide;
interface api {
  keepU: func(value: u64) -> u64 { return value; }
}
world app { export api; }
```

```sh
node scripts/wasmc-agent-execute.mjs --source wide.wasmc --export keepU --calls '[[{"bigint_decimal":"7"}],[{"bigint_decimal":"18446744073709551615"}]]' --expected-results '[{"bigint_decimal":"7"},{"bigint_decimal":"-1"}]'
```

The raw JavaScript Core result is a signed BigInt lane. The all-one bit pattern
of `u64::MAX` is reported as `{"bigint_decimal":"-1"}`; the source value is
still the unsigned `18446744073709551615`. Interpret signedness from the declared
source/WIT type; this runner does not automatically lift unsigned results.
Tuple lanes may mix JSON numbers and these decimal objects. Argument objects
reject extra fields, invalid decimal strings and values outside the combined
signed/unsigned 64-bit input range.

Tuples are one semantic result; a raw JavaScript host observes flattened Core
lanes. A bool lane is `0` or `1`; this is not automatic object lifting. Do not
convert an s32 argument into a boolean unless that transformation was requested.

For independently wrong compiler-digest tests, choose the
`compiler-integrity-rejection` route. Its shipped pure fixture, export and calls
are provided; no new source file is required. It captures the actual verifier nonzero exit
and accepts only the expected digest mismatch. Copy its JSON unchanged once; in
the explanation refer to `actual` and `expected` fields instead of repeating or
shortening digest values. An unexpected error or repaired invocation is a failure.
