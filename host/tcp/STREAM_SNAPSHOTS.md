# Transport-owned snapshots

The copying profile snapshots accepted bytes and the unread tail before
pause/handler cleanup, never retaining a borrowed backend view as an owned
unshifted tail. A persistent data owner is installed when a trusted connection
is admitted, before it waits in the listener queue. Between-request chunks are
captured even if a compatibility backend emits while nominally paused; read
requests consume owned prefixes. No `unshift` or ownerless data-handler gap.
Delivered windows remain at most16bytes; a preserved unread
tail is a backend-stream chunk and is **not a16-byte window allocation**.
This fix is not a total transport-buffer memory budget or zero-copy guarantee.

Write validates bounded indexed values once into an owned Uint8Array. Its
callback retains that snapshot until local acknowledgement and reports the
snapshot count, not caller array length after an await. Callback success is
still only local acceptance, not peer receipt or durability. No effect replay.

```sh
node host/tcp/stream-snapshot-test.mjs
bun host/tcp/stream-snapshot-test.mjs
deno run host/tcp/stream-snapshot-test.mjs
```

Seven controls cover between-request delivery, borrowed-buffer invalidation on pause, several read boundary
shapes/EOF, caller mutation during write and a getter read once during validation.
Before the fix the controlled read produced zeros, and an actual3-byte issued
write reported4 after caller mutation. Those are proved reference bugs, **not
proof of the exact Bun/Linux CI root cause**.

`linux-frame-regression.json` preserves both failed jobs at their exact source.
The required Linux fast stream job now runs the actual JS-only service before
Native build qualification:19connections,17valid/2rejected,1000resident App/Lib
calls and8listener controls. `--diagnose` prints only controlled fixture frames;
ordinary response assertions always label JS versus Native lane. JS-only
receipts explicitly have paired_connections0/native_engine null, never count
as JS/Native parity. The full Native/both-engine/browser gates remain required.

Local Node/Bun/restricted Deno ownership/service proof does not qualify all Linux.
The same Bun1.3.14 Linux ARM binary independently reproduces the original exact
frame12 loss in a local isolated container. A pull/readable-only alternative
passed Bun but failed Deno and was not adopted. The persistent data owner with
early listener admission passes the unchanged19-connection corpus locally on
Linux ARM and macOS Node/Bun/Deno. This narrows the regression to a queued
connection/ownership gap, not App/CoreLib calculation. Exact Linux x64/ARM CI
still must independently qualify the new source. No timer retry or corpus skip.
Until exact corrected-source CI passes, do not mark the preserved frame failure
fixed, add a platform skip, alter expected bytes or add timing retries.
