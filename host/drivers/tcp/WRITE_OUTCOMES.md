# Write completion outcomes — experimental Host driver

`writeTcpWindow` consumes an exclusive preconnected endpoint and at most16
dense byte values. It snapshots data before issuing the write, pins a guard
window, then awaits backend write settlement and any stop/close acknowledgement
before drain/release. The Host chooses AbortSignal and deadline1..5000ms. These
JavaScript records are trusted driver outcomes, not a new guest WIT/Core ABI.

| State | Effect | Acknowledged |
| --- | --- | --- |
| done | accepted_locally | Full local byte count, not peer delivery |
| failed | possibly_partial | Known count or null; error -9 |
| cancelled after issue | possibly_partial | Known count or null |
| cancelled before issue | none | 0 |

A full acknowledged count can coexist with cancelled completion: cancellation
does not undo an external effect. No automatic retry or replay is performed.
Partial/invalid acknowledgements fail conservatively. Host cleanup failure is
reported separately as `cleanup_error`, not substituted for the write outcome.
Raw statuses/tickets stay in reviewed Host glue, never Agent source API.
Guard/endpoint ownership is exclusive. Reliable termination acknowledgement is
required; generic failed/stuck stop still needs quarantine and is unqualified.

```
cargo build --release --locked --manifest-path host/tests/e2e/rust/Cargo.toml
node host/drivers/tcp/write-test.mjs host/tests/e2e/rust/target/release/tcp-write-reference
bun host/drivers/tcp/write-test.mjs host/tests/e2e/rust/target/release/tcp-write-reference
deno run --allow-net=127.0.0.1 --allow-env=NODE_V8_COVERAGE \
  --allow-run=host/tests/e2e/rust/target/release/tcp-write-reference \
  host/drivers/tcp/write-test.mjs host/tests/e2e/rust/target/release/tcp-write-reference
```

Windows adds `.exe`. Both JS and Native first prove a real peer observed four
bytes, then cancel completion. Outcomes match: cancelled, possibly_partial,
acknowledged4, resource cleanup. JS deliberately defers delivery acknowledgement;
Native cancels after explicit peer acknowledgement. This proves cancellation
does not roll back already observed writes; it does **not** prove blocked OS
write preemption or all partial-write races. Five additional JS controls cover
normal completion, write failure, short acknowledgement, pre-aborted no-effect
and deadline cancellation with deferred completion/data snapshot. Existing
read-stop/Lib/server regressions remain required. Actions qualify six desktop
Node/native pairs and four Unix Bun/Deno pairs at the exact new source.
No production networking SDK, browser raw TCP, TLS or immutable release claim.
