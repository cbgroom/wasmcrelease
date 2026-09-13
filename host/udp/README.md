# Bounded preauthorized UDP — experimental real backend

Public Host/glue reference, not a stable syscall ABI or completed typed SDK.
No new kernel import, compiler/CoreLib rebuild, WASI or protocol-specific syscall.
The Host supplies an already-bound UDP4 loopback socket and fixed authorized
peer. No guest address/DNS/bind/reconnect grant. UDP source tuple filtering is
not authentication, protection against spoofing, delivery/order/replay guarantee
or TLS/DTLS. Protocol/state/retry policy stays in Lib; never replay inside Host.

Read returns exactly one complete message, including a valid zero-length
datagram. Application budget16bytes;17-byte and64-byte messages reject bounds(-5)
without publishing a truncated prefix. Wrong source rejects permission(-2),
does not dispatch App/Lib or change the peer. A later valid datagram still works.
Write snapshots indexed u8 bytes once; local callback/send acknowledgement is
not peer delivery or durability. Readonly endpoints cannot write. No stream
EOF/half-close emulation or silent drop-as-success.

JS has a persistent receiver and two-message retained queue. Overflow rejects
limit(-3), suppresses further I/O until explicit close. Check bounds/source before
copying message bytes. Each accepted snapshot is at most16bytes; this does not
bound the platform's own incoming packet/socket buffers. Native owns one65536-byte
resident receive scratch to hold a complete UDP4 datagram on different OSes;
only approved16-byte messages are copied out. It is not a16-byte native memory
footprint. Exclusive Rust mutable borrow supplies serialized access; no Native
async cancellation/thread-race or OS close-fault qualification is implied.

JS rejects concurrent read/write/release with busy(-4). Explicit termination
closes the socket and wakes a pending read; ordinary release waits actual close
ack before discarding queues/endpoint. A failed close retains the stopped owner.
Native std descriptor Drop cannot report every OS close fault or prove crash
durability. Browser has no raw UDP grant; do not import this Node-style adapter
as if browsers support it. No mobile/runtime or production networking claim.

```sh
node host/udp/test.mjs
node host/udp/fault-test.mjs
cargo build --release --locked --manifest-path host/lib-e2e/rust/Cargo.toml
node host/udp/native-test.mjs host/lib-e2e/rust/target/release/udp-server-reference
```

Add `--features wasmtime-engine` to the build and `--wasmtime` to the native
harness for the optional engine; default dependencies remain Wasmi-only.
Node/Bun/restricted Deno execute eight actual messages: five App/Lib calls,
three rejection cases, zero foreign replies. Eleven JS controls verify pending read
lifetime, readonly rights, queue overflow and getter/proxy snapshot consistency,
including a synchronous burst before Promise cleanup: next datagrams remain
queued rather than consumed by an already-resolved waiter.
Both native engines execute the same digest-bound App/algorithm Lib, not a
full Std/no-JIT substitute. Source bytes and paths are trusted fixture setup,
not Guest RPC. Native stdout JSON is test evidence, not a proposed network ABI.

Deno JS test needs loopback network and read access to current compiler, guest
fixture and algorithm Lib; fault test needs only loopback network. Native harness
also needs target/host-udp write, exact binary execution and NODE_V8_COVERAGE
read for Node-compatible spawn. The child environment is empty. Permissions
belong to the test launcher, not the WAsmC Guest.

Local macOS Node/Bun/Deno x Wasmi/Wasmtime parity and Linux ARM/Bun JS ownership
proof passed. Exact cross-platform Actions/main acceptance remain separate.
Do not count these as typed WIT transport/immutable SDK release closure.
