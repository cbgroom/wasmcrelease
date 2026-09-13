# S2 typed file path implementation review

Status: implementation proposal, not accepted v1 WIT, physical ABI, generated
SDK or completed scenario. The [single baseline](../CORE_API_V1_BASELINE.md)
remains authority; this document introduces no Host mechanism or language syntax.

## Vertical slice

The first uniform carrier must support the same ordinary WAsmC and Rust App:

1. Receive an explicitly injected restricted root capability.
2. Describe its bounded grants; derive input-read and output-write endpoints.
3. Acquire a bounded external-I/O window and initiate an input read.
4. Await that exact operation, validate status and initialized byte count.
5. Transform the bytes with the admitted CoreLib; never expose raw tokens,
   offsets into Host memory or numeric opcodes to application source.
6. Commit only initialized output bytes, initiate write and check short writes.
7. Explicitly request the admitted storage-sync operation; verify its result.
8. Retire operations, windows and endpoints after backend acknowledgement.

The embedding independently reopens and compares output. Sync acknowledgement
is not a crash/power-loss proof. No ambient path, automatic retry of writes,
automatic engine promotion or effect replay is permitted in this slice.

## Carrier obligations before fixing signatures

| Concern | Required behavior |
|---|---|
| Identity | Session-scoped typed endpoint/window/operation wrappers; foreign, stale and fabricated carriers reject before effects |
| Correlation | Immediate and deferred results identify their originating operation; wait cannot return an uncorrelated byte count |
| Result | Transfer count and initialized window range are separate; expected errors are typed and partial/unknown effects are explicit |
| Submission | Validation/permission/quota rejection precedes issuance; a successful submission owns one bounded completion slot |
| Windows | Copy helpers are explicit physical carrier helpers, not ordinary heap allocation; snapshot writes and pin reads until actual settlement |
| Wait | Wait deadline ends waiting only; operation remains owned and drainable |
| Cancel | Suppress undelivered payload; stop request is not stop acknowledgement or rollback |
| Release | Busy/failure retain ownership; asynchronous close remains tracked until acknowledged; SDK drop must not silently free pinned resources |
| Quota | Count active and quarantined resources, pending and undelivered results, and initialized queued bytes |
| Cleanup | Failed App/engine invocation transfers outstanding resources to embedding drain/quarantine; no forced free on timeout |

Semantic WIT must be reviewed separately from Core lanes. In particular,
Component resource ownership transfer cannot stand in for non-consuming failed
retirement. A syntactically valid WIT package is not proof of a usable lifetime
model or a compiled WAsmC/Rust SDK. Private producer authority owns generation;
only the reviewed contract, adapters, public engine glue and tests may be open.

## Existing implementation to reuse

Public `PreopenedRoot`, `PreopenedFile`, committed copy windows and scoped
completion guards already prove bounded real-file components. They are not
the guest SDK. Private `invoke_wasmi_async` and `invoke_wasmtime_async` provide
bounded engine suspension; neither supplies an executor, readiness backend,
typed resource session or automatic stop/close acknowledgement. Reuse those
mechanisms rather than adding bespoke file syntax or another compiler allocator.

Keep one generic carrier shared across the twelve mechanism families. File
selection and finite sync semantics may be the first profile, but must not be
implemented through source-name, function-name, hash or task-specific compiler
special cases. Review physical copy/helper count separately from the twelve
mechanism families and their twenty-family design budget.

## Acceptance, not just fixture counts

Required local milestone: ordinary Apps compiled independently, exact imports
admitted, real file read/transform/write/sync and independent output oracle;
both engines where supported, plus Node/Bun/Deno using the same contract.
Required failures: no grant, readonly, quota, EOF/short write, cancellation before
delivery, wait timeout without cancel, stale/foreign/duplicate completion,
failed/busy retirement and post-App-failure drain. An issued effect is never
replayed merely to repair a missing result. Backend stop must be observed,
not asserted by a synthetic completion sender.

Only after this milestone should exact-source desktop Actions qualify the
carrier. Browser permission-bound storage and real mobile devices remain
separate acceptance; unsupported controls do not count as positive I/O coverage.
