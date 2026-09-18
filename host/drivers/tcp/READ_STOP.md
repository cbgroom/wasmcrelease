# TCP read stop and completion drain — development reference

`readTcpWindow` consumes one exclusively owned preconnected endpoint and reads
one prefix of at most16 bytes using the scoped completion guard. Host code
selects an AbortSignal and a deadline (integer1..5000ms, default1000). No guest
address, timer policy, raw token or new physical Host syscall is introduced.
This is Host-side integration glue, not typed guest async or a production SDK.

On abort/deadline the driver cancels delivery, destroys the socket, awaits the
already issued read **and** socket close acknowledgement, drains completion,
then releases operation/window/endpoint. It must not free a pinned window while
the backend might access it. A revoked abort also revokes the guard, denies new
grants and discards delivery. Already-aborted requests issue no read. Success
and backend errors retire their endpoint too; this is not a reusable stream API.
Read error wins over later cleanup error. No automatic read/write replay occurs.

Cancellation and deadline cancellation return `-6`; revoked abort returns `-2`,
read failure `-8`, invalid deadline `-5`. Deadline vs explicit cancellation is
Host policy/context, not a new numeric guest ABI. Completion wins when the read
settles and policy hooks are removed first. Guards and endpoints are exclusively
owned by this driver; concurrent outside mutation/release is not supported.
The injectable test endpoint must acknowledge termination reliably; arbitrary
stuck/failing backends require quarantine, not forced resource release.

Native `tcp-stop-reference` is an independent trusted fixture, not the JS helper
translated into a public SDK. It starts a stop thread with a cloned TCP
descriptor, interrupts a real pending read with `shutdown`, joins/drops the stop
descriptor, then cancels/revokes and drains the exclusively owned guard. Socket
timeout returns from the issued read before drain/close. This verifies bounded
ordered real backend stop, not arbitrary concurrent registry revocation races.

```
cargo build --release --locked --manifest-path host/tests/e2e/rust/Cargo.toml
node host/drivers/tcp/fault-test.mjs host/tests/e2e/rust/target/release/tcp-stop-reference
bun host/drivers/tcp/fault-test.mjs host/tests/e2e/rust/target/release/tcp-stop-reference
deno run --allow-net=127.0.0.1 --allow-env=NODE_V8_COVERAGE \
  --allow-run=host/tests/e2e/rust/target/release/tcp-stop-reference \
  host/drivers/tcp/fault-test.mjs host/tests/e2e/rust/target/release/tcp-stop-reference
```

Windows adds `.exe`. Four paired real loopback journeys: success, cancel,
revoke, deadline. No bytes are written to peers by these readonly drivers.
Nine additional JS controls cover late bytes before deferred close acknowledgement,
primary read error with failing close, already cancelled/revoked calls, and five
invalid deadlines. Oracles verify zero resources, retired endpoint rejection and
revoked grant rejection. Previous eight paired TCP/Lib cases remain regression.
Actions exercise six Node/native targets and four Unix Bun/Deno targets against
the exact new source; local PASS never substitutes for their acceptance.

Still unqualified: write cancellation/partial effects, generic failing stop,
hard wall-clock preemption, resident network services, full typed async transport,
browser/mobile/Wasmtime parity, TLS/UDP and Bun half-close-response behavior.
No production deployment or immutable release is performed by this workstream.
