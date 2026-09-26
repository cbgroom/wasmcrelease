# Data Foundation v1.1 workstream

Status: **STARTED / not released**.

This workstream extends the admitted Data Foundation v1 without changing its
immutable `0.0.1` packages. The producer source is the public `libsrc/`
workspace; compiler source is not involved in the first slice.

## Version boundary

- released baseline: `wasmc:data-relational@0.0.1`;
- development candidate: `0.0.2-dev.1`;
- planned WIT identity: `wasmc:data-relational@0.0.2`;
- admission target: `0.0.2`, only after all gates pass.

The current source base is `b1d22d27bdc9727e607cf77a4af57b151df6832d`.
The original admitted implementation authority is
`ff6928b09194b4818b05117ec0ba6a71b998d224`; relational/compute source code,
WIT and Cargo inputs are unchanged between these two revisions.

## Slice 1 — distinct and offset windows

### distinct

- accepts a validated `batch-snapshot`;
- empty key-column list means whole-row distinct;
- non-empty keys select the deduplication identity;
- selected keys are unique and in bounds;
- first input occurrence is retained;
- output order is stable input order;
- null equals null for deduplication identity;
- all six Data Core types participate in deterministic equality;
- a non-zero maximum input-row bound is mandatory;
- operation never expands row count.

### lag / lead

- reuse the existing `partition-by` + `order-by` semantics;
- reuse explicit ascending/descending and null placement;
- output remains aligned to original input row order;
- value column may be any of the six Data Core types;
- result field is nullable even when input is non-nullable;
- out-of-partition offset returns null;
- offset zero returns the current ordered row value;
- duplicate output aliases and invalid columns fail closed;
- the existing non-zero `max-rows` bound remains mandatory.

## Slice 2 — bounded ROWS frame aggregates

After Slice 1 closes, add bounded row-frame aggregate semantics for
`count/sum/min/max/avg` with rolling and cumulative use cases. Frame semantics
must reuse the same partition/order model. No SQL grammar, DB/storage engine,
spill-to-disk or hidden Host authority is introduced.

## Architecture

`wasmc-data-relational` owns relational/window/frame semantics.
`wasmc-data-compute` remains the generic batch-kernel layer. Runtime
cross-Lib imports are not introduced merely for code sharing; any common Rust
kernel must still compile into import-free final Core artifacts.

## Required evidence

- exact positive and negative behavior vectors;
- deterministic repeated execution;
- old `0.0.1` package byte immutability;
- Core import count = 0;
- Wasmtime behavior qualification, then Wasmi structural/runtime qualification;
- candidate/integrity validators;
- explicit admission review before any immutable release promotion.
