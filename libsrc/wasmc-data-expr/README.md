# wasmc-data-expr — public source candidate

A compact, non-recursive expression program over Data Core batch snapshots.

The public contract is an indexed node list, not SQL text and not a recursive
AST. Every node may reference only earlier nodes. This keeps validation bounded,
makes Agent generation straightforward, and avoids recursive WIT types.

Current operations:

- column and typed literal;
- equality and ordering comparisons;
- add/subtract/multiply/divide;
- boolean AND/OR/NOT;
- is-null.

Implementation uses Arrow-rs 60 comparison, numeric and boolean kernels.
Arrow types remain private implementation details. Host imports: zero.
