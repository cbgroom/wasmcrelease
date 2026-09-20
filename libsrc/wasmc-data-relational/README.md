# wasmc-data-relational — public source candidate

The first relational layer is intentionally narrow: exact-schema union-all,
bounded typed equi-join and deterministic group aggregation over Data Core batch
snapshots.

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
- zero or more grouping columns;
- deterministic ascending lexicographic group order;
- null group keys sort before non-null keys;
- count-all, count, sum, min, max and mean;
- aggregates ignore null input values;
- sum/min/max/mean return null for an all-null group;
- count/count-all return non-null uint64;
- sum/min/max support int64, uint64 and float64;
- mean returns nullable float64;
- zero grouping keys define one global group, including for empty input.

No SQL, storage, connector or Host semantics are introduced. Host imports: zero.
