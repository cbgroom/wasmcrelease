# wasmc-data-compute — public source candidate

Arrow-backed batch operations over the stable Data Core snapshot semantics.

Current operations:

- filter with a Data Core boolean column mask;
- project by column index;
- lexicographical sort with per-key direction/null ordering and optional limit.

This Lib deliberately accepts the same Data Core column type returned by
`wasmc-data-expr`, enabling the composition:

```text
CSV -> Batch -> Expr.evaluate -> BooleanColumn -> Compute.filter
```

The implementation uses Arrow-rs filter/sort/take kernels. Host imports: zero.
