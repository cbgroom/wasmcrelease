# wasmc-data-profile — public source candidate

Column profiling for Agent-first data understanding.

An empty column selection profiles every column in schema order. Explicit
column selection preserves caller order and rejects duplicates.

v0 summaries:

- boolean: null/non-null/true/false counts;
- int64/uint64/float64: null/non-null, min, max, mean;
- UTF-8/binary: null/non-null and min/max/mean byte length.

This deliberately omits exact distinct counting in v0 to avoid silently
introducing unbounded cardinality state. Approximate/exact distinct can be a
separate bounded sketch/profile extension.

Numeric min/max/sum primitives reuse Arrow aggregate kernels. Host imports: zero.
