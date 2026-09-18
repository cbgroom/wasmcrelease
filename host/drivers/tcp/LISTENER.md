# Preauthorized listener and resident App/Lib service — development reference

Host code supplies an already listening server/socket. Guest code gets no bind
address, DNS, listener creation, reconnect or arbitrary OS capability. Listening
and accepting are reusable transport mechanics, not per-HTTP/protocol syscalls.
This is public Host glue and a test service, not a production guest networking SDK.

JS `PreauthorizedTcpListener` owns up to two queued sockets and two active
accepted sockets, one pending accept. Full queues close newcomers; active quota
rejects accept with `-3`, concurrent pending accept with `-4`. Listener release
rejects while accepted sockets remain active (`-4`); the owner must finish/close
them first. Release cancels pending accept (`-6`), closes queued sockets and waits
for listener close. Retired accept/release reject `-1`. Accepted socket close
removes it from backend-active counts; these are not general guest resource
table/lifetime counts. Trusted Host and this adapter exclusively own the server.

Native wraps a trusted `TcpListener`, polls nonblocking accept with a bounded
Host deadline (1..5000ms), explicitly switches accepted sockets to blocking mode
and uses500ms per-read/per-write fixture deadlines. The reference is serialized,
one active connection; it does not implement the JS two-active queue policy.
Cancellation is now supported via a fresh `AcceptCancellation` handle per
accept lifetime: a trusted controller cancels from another thread. The poll loop
checks before accepting and before handing out a socket, returning `-6` and
dropping a raced socket if cancellation wins. A delivered accept wins its final
check; cancellation does not revoke an already delivered endpoint. Handles are
terminal, not reset/reused. A cancelled wait leaves listener authority intact;
a new wait uses a fresh handle. This is bounded polling, not an evented SDK.
Idle deadline returns `-6`; invalid
deadline `-5`, backend failure `-8`, retired listener `-1`. Polling sleeps1ms;
this is a portable reference, not a peak-performance server design.

The service's reviewed fixture protocol is one byte of length0..16, that many
bytes of payload, eight bytes of little-endian i64 response. Framing/marshalling
is test glue, not a physical Host ABI. Sum computation runs in the frozen,
digest-bound, zero-import `wasmc-owned-algorithms@0.1.0` Wasm Lib. JS and Native
Wasmi each instantiate both the same compiler-produced WAsmC App and Lib once,
reuse a64-byte input slab across every valid connection and route computation
through App `run` -> explicitly bound `transport.sum_window` -> Lib `sum-s32`.
Native resets fuel per call; a trap poisons the resident App in both drivers,
and subsequent calls are rejected before the Lib runs. No automatic retry.
JS frees its slab at shutdown; Native Store/slab are reclaimed on service drop.
This qualifies the reviewed resident App/Lib fixture, not arbitrary guest async,
hard wall-clock execution limits or long-run allocation stability.

Malformed length and truncated input are rejected before Lib calls. Following
valid requests continue on the same listener/Lib. Write failure may have partial
effects and is not retried. Read/write deadlines are fixture bounds, not a hard
wall-clock VM preemption guarantee. Peer delivery/durability is not implied by
local write success. Browser raw TCP, TLS, UDP and HTTP are not provided here.

```
cargo build --release --locked --manifest-path host/tests/e2e/rust/Cargo.toml
cargo test --release --locked --manifest-path host/tests/e2e/rust/Cargo.toml
node host/drivers/tcp/server-test.mjs host/tests/e2e/rust/target/release/tcp-server-reference host/tests/e2e/rust/target/release/resident-app-reference
bun host/drivers/tcp/server-test.mjs host/tests/e2e/rust/target/release/tcp-server-reference host/tests/e2e/rust/target/release/resident-app-reference
mkdir -p target/host-tcp-app
deno run --allow-net=127.0.0.1 --allow-read=current,host/tests/e2e,libs/wasmc-owned-algorithms,target \
  --allow-write=target/host-tcp-app --allow-env=NODE_V8_COVERAGE \
  --allow-run=host/tests/e2e/rust/target/release/tcp-server-reference,host/tests/e2e/rust/target/release/resident-app-reference \
  host/drivers/tcp/server-test.mjs host/tests/e2e/rust/target/release/tcp-server-reference host/tests/e2e/rust/target/release/resident-app-reference
```

Windows adds `.exe`. Nineteen paired connections verify17 Lib calls per engine,
two rejected frames and one App/Lib instance per engine. Each engine also runs
1000 resident App/Lib calls followed by budget rejection and trap poisoning,
verifying post-trap refusal does not replay the Lib. Exact App/Lib digests are
verified before execution; generated App bytes live under ignored target/.
Eight JS listener controls
cover pending-accept exclusivity/cancellation, retired access, active-close
denial, two queued sockets/full-queue rejection and two-active quota. A Native
test pair verifies idle accept deadline/retirement and pending cancellation,
including terminal cancelled-handle refusal and fresh-wait success. Actions add this
journey to six Node/native desktop targets and four Unix Bun/Deno targets.
The existing TCP/Lib, read-stop and file/App/Lib regressions remain mandatory.
Local PASS is not exact-source cross-platform acceptance or immutable release.
