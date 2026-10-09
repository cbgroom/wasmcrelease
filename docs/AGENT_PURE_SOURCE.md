# Pure source: write, run, change

This small guide covers ordinary scalar and tuple programs. Choose source only
after Library-first discovery for reusable computation. Create your own `.wasmc`
file in the current checkout. For syntax outside this guide read the relevant
section of LANGUAGE.md; supported type/feature positions are decided separately.

A complete file declares a package, an interface with function bodies, and a
world exporting that interface. Parameters use WIT fixed-width types, including
`s32` and `bool`. Use `true` and `false` for boolean arguments. A function returns
exactly one semantic value. Preserve several requested values independently in
one tuple or record; boolean conjunction discards those separate values.

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
Expressions include fixed-width arithmetic and comparisons. Use `if (condition)
{ ... }` and `return value;`. Public entrypoints are `name: func(...) -> type`
inside the exported interface, rather than Rust `pub fn` declarations.

The execution runner takes `--source`, `--export` and `--calls`. Calls are JSON
arrays of positional argument arrays: `[[3,true],[-1,false]]` for two parameters.
They are not objects containing an `args` property. Match the requested arguments
and exported signature. The runner checks actual compiler/facade digests, compiles
the file, inspects imports, refuses Host imports before instantiation, instantiates
with `{}`, and returns source/Core hashes plus actual results. One invocation
handles all requested calls. Report its evidence once and stop.

Tuples are one semantic result; a raw JavaScript host observes flattened Core
lanes. A bool lane is `0` or `1`; this is not automatic object lifting. Do not
convert an s32 argument into a boolean unless that transformation was requested.

For independently wrong compiler-digest tests, use the route's rejection probe
with the same argument-array format. It captures the actual verifier nonzero exit
and accepts only the expected digest mismatch. Copy its JSON unchanged once; in
the explanation refer to `actual` and `expected` fields instead of repeating or
shortening digest values. An unexpected error or repaired invocation is a failure.
