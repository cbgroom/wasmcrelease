# wasmc-data-relational — public source candidate

The first relational layer is intentionally narrow: deterministic group
aggregation over Data Core batch snapshots.

v0 semantics:

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
