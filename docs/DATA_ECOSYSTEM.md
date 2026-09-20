# WAsmC Data Ecosystem

The WAsmC data stack follows the same rule as the Host/Lib architecture:

**stable WIT semantics, mature Rust implementation, minimal reinvention.**

Third-party Rust types are implementation details. They must not become WAsmC
ABI types merely because the first implementation uses a particular crate.

## Foundation rule

```text
File / Network Host
        ↓
format Libs
        ↓
Data Core semantic snapshot
        ↓
compute / relational / statistics Libs
        ↓
SQL / DataFrame / Agent facades
```

The first Data Core contract freezes only generic mechanisms: schema fields,
typed columns, row counts, nullability and batch semantics. It does not freeze
domain-specific data shapes.

The current portable path is a copied `batch-snapshot`. A future resident or
resource fast path may reduce copies without changing the semantic rule that
Arrow/Rust implementation types remain private.

## Rust implementation policy

### Direct implementation dependencies

Use these crates directly inside Libs where their semantics fit:

- Rust `core` / `alloc` / pure in-memory `std` collections and iterators.
- `serde` / `serde_json` for structured JSON.
- `csv-core` or Arrow CSV for CSV parsing.
- `lexical-core` for numeric text conversion.
- `regex` / `regex-automata` for bounded text matching.
- `hashbrown` for hash/group/join kernels.
- `indexmap` for stable ordered metadata.
- `itertools` for iterator glue.
- `ordered-float` for deterministic float ordering/hashing.

These are implementation dependencies, not WIT identities.

### Thin WIT facade dependencies

Use mature Rust implementations but expose smaller WAsmC semantics:

- `rust_decimal` for decimal arithmetic.
- `ndarray` for dense numerical arrays.
- Apache Arrow-rs for schema, arrays, batches and compute kernels.
- Arrow CSV/JSON/IPC and Parquet for format adapters.

### Reference or selectively reusable systems

DataFusion and Polars are valuable semantic, planner and benchmark references,
but their full runtime/I/O/parallel execution surfaces are not the Data Core ABI.
Reuse lower-level crates only after the exact wasm profile is qualified.

## Current Data Foundation v1

### wasmc-data-core

Public ABI:

- generic primitive data types;
- schema fields;
- typed nullable columns;
- `batch-snapshot`;
- `validate`;
- `take`.

Implementation:

- `arrow-schema 60.0.0`;
- `arrow-array 60.0.0`;
- `arrow-select 60.0.0`.

The current candidate compiles to `wasm32-unknown-unknown` with zero Core
imports. Arrow types are not exposed through WIT.

### wasmc-csv

The CSV adapter consumes caller-supplied schema and emits lists of Data Core
batch snapshots. It intentionally does not freeze schema-inference policy in
the CSV ABI.

Implementation:

- `arrow-csv 60.0.0`;
- `arrow-array 60.0.0`;
- `arrow-schema 60.0.0`.

The candidate has zero Core imports. Its only Component-level dependency is the
type-only `wasmc:data-core/types@0.0.1` identity.

### wasmc-data-expr

The expression layer is a bounded, non-recursive indexed program rather than
SQL text or a recursive AST. Current nodes cover column/literal, comparison,
numeric arithmetic, boolean logic and is-null. The implementation uses
Arrow-rs comparison/arithmetic/boolean kernels and has zero Core imports.

### wasmc-data-compute

The first batch-compute layer provides filter, project and lexicographical
sort with optional limit. Filter accepts the same Data Core boolean column
returned by `wasmc-data-expr`, so the portable composition path is:

```text
CSV -> BatchSnapshot -> Expr.evaluate -> BooleanColumn -> Compute.filter
```

All operations are Arrow-backed and have zero Core imports.

### wasmc-data-relational

The first relational primitives are exact-schema `union-all`, bounded typed
`equi-join`, bounded deterministic `window-rank` and deterministic
`group-aggregate`, not SQL. Union preserves
input batch and row order, requires exact field name/type/nullability equality
and performs no implicit coercion. Join supports inner/left composite exact-type
keys, preserves left-row then right-row order, never matches null keys and
requires an explicit non-zero maximum output row count. Window rank appends
row-number/rank/dense-rank columns, preserves input row order and row count,
supports partitioned composite ordering with explicit null placement, and
requires a non-zero maximum input row bound. Group aggregate supports
zero or more group keys, count-all/count/sum/min/max/mean, ordered null-ignoring
first/last across all six types, and numeric population variance/standard
deviation using a one-pass Welford accumulator.
Grouping order is deterministic lexicographic order with null keys first.
Numeric aggregation is Arrow-backed; integer sum overflow fails closed.

The end-to-end qualified internal path is now:

```text
CSV
  -> BatchSnapshot
  -> Expr.evaluate
  -> Compute.filter
  -> Relational.union-all
  -> Relational.equi-join
  -> Relational.window-rank
  -> Profile.describe
  -> Relational.group-aggregate
  -> Interchange.arrow-ipc-file round-trip
  -> Interchange.parquet round-trip
  -> Data Core validate
```

Every Core artifact in this path has zero Host imports.

### wasmc-data-profile

The first statistics layer provides deterministic per-column profiling for
boolean, int64, uint64, float64, UTF-8 and binary columns. It reports null and
non-null counts; boolean value counts; numeric min/max/mean; and UTF-8 byte
length or binary length min/max/mean. Empty selection profiles every column in
schema order; explicit selection preserves caller order and rejects duplicates.

Exact or approximate distinct counting is intentionally outside v0 so profiling
cannot silently allocate unbounded cardinality state. The candidate is
Arrow-backed and has zero Core imports.

### wasmc-data-interchange

The first interchange layer provides bounded Arrow IPC file and Parquet
encode/decode over Data Core batch snapshots. IPC preserves batch boundaries.
Parquet combines exact-schema inputs and decodes into caller-bounded batches.
Both paths support all six Data Core types, require explicit input/output byte,
batch and row limits, and have zero Host imports. Filesystem and network effects
remain outside this Lib.
The Wasmi structural gate and the real CSV-to-relational pipeline both cover
this candidate; the latter round-trips the final aggregate through Arrow IPC
file and uncompressed Parquet before Data Core validation.

## Build workspace vs final package

`libsrc/` is an incubation/build workspace, not the final Lib package.
Rust/Cargo may be used by the Rust-backed build lane, but Cargo is not the Lib
format and third-party source trees are never package payload.

An admitted Lib remains source-free:

```text
<lib>/
  SKILL.md
  lib.wit
  lib.json
  artifact.wasm
  component.wasm
  references/agent-delta.json
```

The admitted-package validator rejects extra source/Cargo files. Rebuild
authority records exact dependency identity/version/source/checksum, builder
and toolchain identity, build profile, WIT/mapping identity and final artifact
digests. Third-party source is fetched by the build backend when required.

## Admission closure

The seven Data Foundation v1 candidates completed local behavior, zero-import,
Wasmi structural qualification and hosted review gates. Explicit maintainer
approval on 2026-09-20 admitted immutable `0.0.1` packages under `libs/`.
`scripts/review-data-admission.mjs` verifies the closed lifecycle, exact
source authority, canonical source-free package shape and artifact identity.
The public source remains in `libsrc/` as rebuild authority only; it is not
part of any admitted consumer package.

## Next layers

Do not build SQL first. Grow the shared middle layer in this order:

1. Data Core schema/batch semantics. **Started.**
2. CSV ingestion. **Started.** JSONL remains next format input.
3. Expression IR and Arrow-backed compute kernels. **Started.**
4. Relational operators: bounded union/join/window/group aggregate **admitted in v1**.
5. Statistics and profiling **admitted in v1** with deterministic column profiles.
6. Arrow IPC and Parquet adapters. **Admitted in v1.**
7. DataFrame/Agent facades.
8. SQL parser/planner only as an optional late frontend.
9. Time series, sketches, numerical/linalg extensions.

A new data Lib should first search for a mature Rust implementation. Reimplement
an algorithm only when the existing crate cannot satisfy the portable wasm,
authority, licensing, size, determinism or semantic boundary requirements.
