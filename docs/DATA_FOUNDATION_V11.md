# Data Foundation v1.1 workstream

Status: **IMPLEMENTATION QUALIFIED / admission pending / not released**.

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

Slice 2 adds `window-aggregate` with explicit start/end ROWS bounds:

- start: unbounded, preceding(n), current-row or following(n);
- end: preceding(n), current-row, following(n) or unbounded;
- invalid start-after-end definitions fail closed;
- partition-edge clipping may produce an empty frame;
- count-all/count return zero for an empty frame, while sum/min/max/mean return
  null;
- count/sum/min/max/mean support rolling, cumulative, centered and full-partition
  forms;
- integer sum/mean accumulation fails with `overflow` instead of wrapping;
- the existing partition/order/null/tie model is reused and output remains
  aligned to original input rows.

The qualified artifact remains a `0.0.2-dev.1` candidate: 77/77 Wasmtime
semantic cases pass, Wasmi 2.0 validates and instantiates the exact retained
Core, and two isolated Core/Component builds are byte-identical. Core is
957,985 bytes with SHA-256
`97a28721dffd9a3f77a8805110be2a5a57e12cdf9b66026e828de17a876ad4ac`
and zero imports. Component is 964,342 bytes with SHA-256
`3fe6dbea05308e1cc4d375264410eabaa3b6f8045d6a39ae32725e7a9f967e46`.
The durable receipt is
`admission/data-foundation-v11/relational-v002-rows-frame.json`.

No SQL grammar, DB/storage engine, spill-to-disk or hidden Host authority is
introduced. Admission review is still required before release promotion.

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
