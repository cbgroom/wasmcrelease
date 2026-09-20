# wasmc-data-relational — public source candidate

The first relational layer is intentionally narrow: exact-schema union-all,
bounded typed equi-join, bounded deterministic ranking windows and deterministic
group aggregation over Data Core batch snapshots.

v0 semantics:

- union-all preserves batch order and row order;
- union-all requires at least one batch and exact field name/type/nullability;
- union-all performs no implicit coercion and fails closed on row-count overflow;
- equi-join supports inner and left joins with one or more exact-type keys;
- join output is ordered by left row, then matching right row;
- a null in any key position never matches, including null-to-null;
- every join requires a non-zero max-output-rows bound;
- right output names use the caller-supplied prefix and collisions fail closed;
- left join makes all right output fields nullable;
- window-rank appends row-number, rank and dense-rank uint64 columns without
  changing input row order or row count;
- windows support zero or more partition columns and one or more typed order
  columns with explicit ascending/descending and nulls-first/nulls-last;
- equal order keys use original input order as the deterministic row-number
  tie-break while rank and dense-rank retain tie semantics;
- every window requires a non-zero max-rows bound;
- duplicate window functions and inputs above max-rows fail closed;
- zero or more grouping columns;
- deterministic ascending lexicographic group order;
- null group keys sort before non-null keys;
- count-all, count, sum, min, max, mean, first, last, population variance and
  population standard deviation;
- aggregates ignore null input values;
- sum/min/max/mean/first/last/variance/stddev return null for an all-null group;
- count/count-all return non-null uint64;
- sum/min/max support int64, uint64 and float64;
- first/last support all six Data Core types and preserve original input order;
- mean/variance/stddev return nullable float64;
- variance/stddev use a deterministic one-pass Welford accumulator;
- zero grouping keys define one global group, including for empty input.

No SQL, storage, connector or Host semantics are introduced. Host imports: zero.
