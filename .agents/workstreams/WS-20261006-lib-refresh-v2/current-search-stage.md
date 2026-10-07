# Current-registry Lib Search stage

Task: task-wasmc-thin-host-semantic-lifecycle-closure.

## Reconciliation and activation

2026-10-07: YXSGIT committed main f11cc1b3 is older than the pushed
topic7165a087 checkpoint bc0dee76. Main also contains unowned task-index edits;
do not overwrite or commit them. The topic and live source agree:
wasmcrelease c1499e0aea83741526d3b5a83e37d70f6558d0d4 and logical Wasmtime
90599dd8e80b4211073e56a2f11c885b1509fa00. Both branches were fetched, upstream
0/0, no staged/unstaged/untracked files or intervening commits, no active writer.
Read current refresh/Host/integrity contracts and retained dual-engine evidence.

First executable action: implement current-registry Search, not a frozen
historical index. Keep source registration, generated artifact identity and
runtime/device qualification separate.

## Implementation boundary

Implement wasmc-lib-search 0.5.0 as ordinary Rust delta + thin adapter/value
profile, with an explicit caller-supplied index. Generate that index from current
registry/WIT and optional exact successful refresh receipts. Do not embed a
frozen catalog or rebuild the Search binary merely because index contents change.
This also avoids the self-manifest digest cycle when Search indexes itself.

Identity is implementation ID + version + public API route, not WIT identity
alone: Android and iOS display implementations share one WIT identity.
Missing build evidence stays source-only; native source packages are not Wasm.
Discovery never grants admission, installation authority or ambient Host access.

## Validation and checkpoints

1. Deterministic index, all current source identities and WIT-derived API routes.
2. Duplicate implementations preserved; bad routes and stale/mutated receipts reject.
3. New Search Q0, native delta tests and generated-artifact behavior including
   pagination, bounds, Unicode, filters and exact lookup.
4. Actual ordinary WAsmC App snapshot/search/lookup on both logical engines.
5. Commit/push source and refresh Skill/evidence/Works before expanding scope.

Do not mutate immutable old releases, add compatibility fallback, count pending
Std/Resident as implemented, or expand local PASS to full-cohort/Q3/device claims.
