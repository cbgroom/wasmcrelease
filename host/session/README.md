# Shared Host session candidate

This is open, trusted **JS embedding SDK** code, not an accepted Core ABI,
generated WAsmC/Rust resource SDK or production/mobile release. It implements
the twelve [baseline](../CORE_API_V1_BASELINE.md) families with one ownership
and completion kernel shared by actual file, TCP and UDP adapters. The ordinary
async WAsmC fixtures initiate their effects; bindings capture typed JS resource
objects. No application sees the private object registry or integer handles.

## What is now shared

- `describe`, `open`: named preopened grants only, finite rights attenuation and
  exactly one transfer. No guest-selected OS paths or peers.
- `read`, `write`, `invoke`: one owned operation/result model; finite
  `storage-sync` is the initial invoke profile, not arbitrary native dispatch.
  `accept` is a listener-only profile: reserve the child slot before issuing,
  retain the accepted endpoint in its operation until `take_result`, and close
  an unclaimed/cancelled endpoint during operation retirement. A failed close
  retains ownership for cleanup only; it cannot reopen result claiming.
- `wait`, `cancel`, `release`: correlated passive results, bounded wakeups,
  non-consuming busy/failed cleanup, actual settlement/close acknowledgement.
  `take_result` is a carrier helper that claims the terminal result exactly
  once, including errors; observing with `wait` never claims it. Claiming does
  not retire the operation or free quarantined pins.
- `clock_read`, `entropy_fill`: explicitly injected sources, no fallback.
- `window_acquire`, `window_commit`: bounded external-I/O copies, not a general
  allocator. `copy_out` is a required SDK copy helper, not another external
  mechanism; physical Core helper inventory remains to be reviewed.

One session owns at most four endpoints, four windows (sixteen bytes each),
four operation records and four active waits. Undelivered terminal and
quarantined operations retain quota. Transfers use already-reserved window
storage; terminal metadata has a finite fixed shape and no arbitrary payload.
Backend diagnostic strings are not copied into results. Result/copy retention
in caller-owned JS memory is not a Host heap budget or a generated CoreLib
allocation contract.

Wait timeout returns no ready receipt and does not consume/cancel the operation.
Cancel suppresses delivery but not external effects. Stream/datagram stop is
requested only for a still-running read; backend settlement and stop promise
must both finish before unpinning. Failed stop keeps pins even after read
settlement. Explicit operation retirement then closes the settled backend;
failed close keeps ownership for cleanup-only retry. Never-settling backend/stop
promises remain bounded and pinned: **outer containment is still required**.
No timeout force-free, automatic replay, promotion or rollback is implemented.

Completion publication is the cancellation linearization point. Cancellation
after backend settlement but before publication suppresses delivery without
starting a new stop; after publication it reports already-terminal. Root
retirement revokes the session and closes only unopened grants. Existing owned
children/operations must still be explicitly drained and retired.

## Three end-to-end journeys

```sh
node host/session/file-test.mjs
bun host/session/file-test.mjs
deno run --allow-read --allow-write host/session/file-test.mjs
node host/session/network-test.mjs
deno run --allow-read --allow-net=127.0.0.1 host/session/network-test.mjs
node host/session/fault-test.mjs
bun host/session/fault-test.mjs
deno run host/session/fault-test.mjs
```

File: four actual inputs, guest-driven read/Lib/write/sync/release, independent
disk oracle, actual issued-read cancellation and all resource counts zero.
Clock/entropy run through the same session. Sync acknowledgement is not crash
durability. The local Lib sum effect is fixture marshalling, not a general async
Lib SDK. These frozen qualification Lib bytes are reused, not rebuilt here.

Network: twelve real TCP sessions and four UDP requests reuse one resident
App/Lib. TCP also reuses one HostSession and guest-initiated accept. Wait timeout retains pins; explicit cancel drains actual TCP close and
delivers zero response bytes. Oversized datagrams reject without partial
delivery. Transport is bounded read-to-EOF or one datagram, **not HTTP/TLS**.
Listener bind remains embedding-owned; the ordinary WAsmC App requests accept
and receives its connection through the shared one-shot result helper. A
pending accept cancellation detaches the readiness waiter before retirement;
it does not imply the listener has closed. Actual listener release awaits close.

Fault: 57 deliberately controlled lifetime checks cover terminal-result quota,
bounded waiters, foreign/stale resources, failed stop/close ownership, explicit
cleanup retry and reentrant retirement. These do not prove OS failure recovery.

### Independent Native peer and Bun compatibility failure

The same-runtime Bun1.3.14 half-close client loses responses in the local
network test. Keep the strict failure; do not call this client path qualified.
Using the independent Native peer below passes the **Bun service** path and
separates the client behavior from the Host session/server implementation:

```sh
rustc --edition=2024 -C opt-level=s -C strip=symbols -D warnings \
  host/session/network-peer.rs -o target/nonblocking-read/network-peer
bun host/session/network-test.mjs target/nonblocking-read/network-peer
```

Node/Deno also pass with this peer. Deno's optional Node-compatible child-process
harness additionally needs explicit `--allow-env` and `--allow-run` for the peer;
these trusted harness permissions are not guest Host grants. Without a Native
peer Deno needs only read/network permissions. Receipt `tcp_peer_profile`
distinguishes the tested paths; a Native peer PASS does not erase Bun client
failure or prove all outbound/half-close contracts.

## Remaining full-delivery gates

The durable Host goal is not achieved by this JS kernel: parser-validated v1
semantic WIT, deterministic Core resource/status/copy carrier, ordinary Rust
consumer, Native same-session executor/readiness, listener/control contracts,
operation deadlines/revocation/containment, HTTP/TLS composition, and supported
browser/mobile real-device acceptance remain. Native scalar file fixtures and
JS opaque objects are different evidence, not equivalent resource SDKs. Keep
the existing five-scenario plan unaccepted until these gates really close.
