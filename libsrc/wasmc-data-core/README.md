# wasmc-data-core — public source candidate

This package defines the first portable WAsmC data-plane semantics without
making Arrow a public ABI.

Public WIT contains only generic schema fields, typed columns and a copied
`batch-snapshot`. The implementation is deliberately backed by Apache
Arrow-rs 60 (`arrow-schema`, `arrow-array`, `arrow-select`).

The snapshot is the portable semantic path. It is intentionally not claimed to
be the final zero-copy hot path. A future resident/resource fast path may be
added without changing the rule that third-party Rust types never become WAsmC
ABI types.

Current primitive columns: bool, s64, u64, f64, UTF-8 and binary.

Host imports: zero.
