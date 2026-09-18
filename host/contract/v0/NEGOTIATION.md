# Bounded Core profile negotiation

Mutable experimental reference only; not a frozen universal Host ABI. WIT is
the semantic draft; this scalar Core profile is a separate executable contract.
No new Host import, Rust ABI, JSON RPC, ambient authority or Component dependency.

Existing `describe(endpoint, field) -> s32` reads one trusted fixture field:

| Field | Meaning | Writable fixture | Readonly fixture |
| --- | --- | --- | --- |
| 0 | Existing fixture rights code | 3 | 1 |
| 1 | Bounded Core profile version | 1 | 1 |
| 2 | Window feature bit mask | 1 (copy) | 1 (copy) |
| 3 | Maximum window bytes | 16 | 16 |
| 4 | Maximum operation records | 8 | 8 |

Unknown endpoint returns -1; unknown field returns -7. Field0 preserves the
original fixture rights values, not a promise ordinary read/write primitives
are implemented. Mask bits2/4/8 reserve shared windows/batch/ring but are absent.
Limits describe capacity, not current availability or a reservation. Independent
quota checks still apply at allocation/submission. Description does not enlarge
capabilities. These values characterize the explicitly injected memory simulator,
not real file/TCP cancellation, zero-copy, TLS, clock or entropy support.

`negotiation-guest.wasmc` checks rights, exact reviewed profile version, nonnegative
feature response, required copy bit, window capacity and operation capacity
before allocation/invoke. Negative feature status must be checked before bitwise
masking (-7 also has bit0 set). Unknown version/capacity/feature returns -7 with
no resource allocation or external effect; there is no silent fallback. Actual
provider/profile identity and authority remain the trusted loader's responsibility;
this fixture scalar handshake alone is not authentication or a full WIT SDK.

## Reproduce

Build the reference and run `node host/contract/v0/core-test.mjs <binary> --negotiated`.
Add `--wasmtime` for the optional Wasmtime feature build. Bun and restricted
Deno run the same harness; ordinary `guest.wasmc` remains a separate regression.
Four successful lengths and seven injected description denials execute the same
compiled guest in JS and Native. Faults override one trusted description field
via Native test CLI `--describe-override=field:value`; no guest API provides it.
Native fault receipt additionally counts all non-describe Host calls: denial
must return -7, zero windows/operations/device bytes AND zero effect calls.
Node/Bun/Deno x Wasmi/Wasmtime cases enter the six-platform Core Host Action.

`test.mjs` also compares105 scenarios/10046 transitions with explicit scalar
description oracles. No arbitrary-device, asynchronous completion, browser
mobile, power-failure or immutable SDK qualification is implied. Full transport
ownership/session/resource SDK review remains a separate delivery gate.

## Failure propagation and retained owners

The caller checks allocation/commit/submission responses before using a handle.
It returns the original error, not a sum of later failures on invalid handles.
Known pre-submission failure releases its newly acquired unpinned window; it
does not touch preexisting owners. Unknown completion returns its error without
releasing the pending operation or pinned window. Host supervision must resolve
settlement/termination; a completed Core call is not proof backend I/O stopped.
Only the reference's terminal cancellation path permits normal release attempts.
This does not inherit simulator cancellation guarantees into a real backend.

Five further Core controls execute identically in JS and Native: preexisting
window quota and injected failure before allocation, commit, invoke or wait.
Native trusted test CLI uses --preload-window-quota or --fail-before=name:code;
these are fixture seams, not guest API or runtime RPC. Quota preserves eight
preexisting windows; allocation failure stops after one non-describe call.
Commit/invoke failures free only their new window. Unknown wait error retains
one window/operation and zero simulated device bytes, with no retries/replay.
Receipt resource_cleanup is scoped to successful/known preissue failures,
excluding preexisting or unknown-completion owners; retained counts are explicit.
Store teardown is safe only for this no-async memory simulator, not a model for
disposing real asynchronous backends with live pins.
