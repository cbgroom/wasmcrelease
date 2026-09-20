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

## Next layers

Do not build SQL first. Grow the shared middle layer in this order:

1. Data Core schema/batch semantics.
2. CSV and JSONL ingestion.
3. Expression IR and Arrow-backed compute kernels.
4. Relational operators: filter/project/sort/hash/join/group/aggregate/window.
5. Statistics and profiling.
6. Arrow IPC and Parquet adapters.
7. SQL parser/planner and DataFrame/Agent facades.
8. Time series, sketches, numerical/linalg extensions.

A new data Lib should first search for a mature Rust implementation. Reimplement
an algorithm only when the existing crate cannot satisfy the portable wasm,
authority, licensing, size, determinism or semantic boundary requirements.
