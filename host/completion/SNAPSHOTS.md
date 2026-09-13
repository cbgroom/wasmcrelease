# Completion and TCP driver snapshots

The copying public Host guard captures array length and indexed u8 values once,
before committing completion state. Validation and delivery use that same owned
snapshot, not a second iterator/getter evaluation. Sparse/out-of-range values
reject before draining pins. Cancellation during capture suppresses delivery.
Trusted JavaScript glue getters may reenter: an already-settled operation is
rechecked before state mutation, so the outer call cannot overwrite it.

The TCP write driver likewise captures indexed bytes once before allocating a
guard or issuing I/O. Invalid input never reaches the backend. Capture is not
language heap allocation; this is the already-declared bounded copying Host
profile, not shared memory/zero-copy or CoreLib-owned application memory.

```
node host/completion/snapshot-test.mjs
node host/tcp/write-snapshot-test.mjs
```

Nine completion and eight driver controls cover getters/Proxy length, sparse
and invalid values, cancelled delivery and reentrant duplicate completion.
They also pass Bun/restricted Deno. Actual Chrome/Firefox/WebKit additionally
run three completion and one write snapshot case. JS/Native76-transition parity,
ten ordinary fault controls,40000-cycle lifetime, cancellation/retirement and
supervisor controls remain mandatory. Getter/reentry controls are JS-specific;
do not call them Native OS race or cryptographic isolation qualification.

The old implementation reproduced getter7->256 after validation and driver
issuance of a reread invalid snapshot. No new Guest import, Core ABI epoch,
compiler/provider rebuild, business I/O replay or immutable release is involved.
