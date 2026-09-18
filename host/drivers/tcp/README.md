# Preconnected TCP + algorithm Lib — development reference

Follow-up [read stop/drain reference](READ_STOP.md) covers real cancellation,
deadline and revoked delivery cleanup. It does not qualify write cancellation.
The [write-outcome reference](WRITE_OUTCOMES.md) preserves possibly-partial
effects on cancellation; blocked OS write preemption remains unqualified.
The [preauthorized listener/resident Lib service](LISTENER.md) reuses one Lib
across19 connections, including malformed input and subsequent valid requests.

The trusted Host provides an already connected stream. The adapter exposes
bounded `read`/`write`/`release`, no guest-selected address, DNS, listener,
reconnection or protocol-specific syscall. This is public integration glue,
not a completed production network SDK or an addition to the physical Core ABI.
Native uses `TcpStream`; JS uses a paused Node-compatible socket in Node/Bun/Deno.
Browser raw TCP is unsupported, never silently replaced with HTTP/WebSocket.

Read returns an available prefix of at most16 bytes; EOF returns an empty array.
TCP does not preserve message boundaries. The fixture supplies a trusted bounded
input length, sends an eight-byte sum result and checks subsequent peer EOF. That
framing is not a universal protocol API.
The portable fixture does not require a response write after receiving FIN:
an initial EOF-framed probe lost that response under Bun1.3.14. Half-close
response parity remains unqualified rather than silently claimed fixed.
Paused-stream EOF also exposed a Deno advancement difference; the JS adapter
now explicitly resumes only while one read is pending and pauses after delivery.
Oversized received chunks retain their suffix for the next read.
Computation runs in the existing
digest-bound, zero-import `wasmc-owned-algorithms@0.1.0` Wasm Lib, not Host code.
JS WebAssembly and Native Wasmi execute the same Lib bytes. The Native executable
accepts an address from the trusted test launcher only; it is not a guest CLI.

Write success means accepted by the local transport, not peer acknowledgement,
durability or exactly-once processing. Failed writes may have partial effects;
there is no automatic retry. Readonly writes reject `-2`, invalid lengths `-5`,
retired resources `-1`, reads/backend failures `-8`, writes `-9`. JS exclusive
pending I/O rejects concurrent operations/release with `-4`; Native uses exclusive
mutable access. Release retires the descriptor, even if Native shutdown fails.
`release` is descriptor retirement, not a graceful protocol shutdown or a flush
guarantee. JS destroys the socket and awaits its close event; `destroyed=true`
alone is not the acknowledgement. Native shutdown/drop retires the descriptor.
Only live preconnected JS sockets may be wrapped; already destroyed ones reject.
Host code owns connection limits, timeouts and socket lifetime; guest code cannot
select these. The test sets five-second Native socket deadlines and a six-second
server cleanup bound. These are fixture bounds, not a negotiated deadline ABI.
The overall test watchdog fails at30 seconds instead of leaving CI hanging.
Two Rust tests exercise real stream retirement and a socket read-deadline failure.

```
cargo build --release --locked --manifest-path host/tests/e2e/rust/Cargo.toml
cargo test --release --locked --manifest-path host/tests/e2e/rust/Cargo.toml
node host/drivers/tcp/test.mjs host/tests/e2e/rust/target/release/tcp-reference
bun host/drivers/tcp/test.mjs host/tests/e2e/rust/target/release/tcp-reference
deno run --allow-net=127.0.0.1 --allow-read=libs/wasmc-owned-algorithms \
  --allow-env=NODE_V8_COVERAGE --allow-run=host/tests/e2e/rust/target/release/tcp-reference \
  host/drivers/tcp/test.mjs host/tests/e2e/rust/target/release/tcp-reference
```

Windows adds `.exe`. Eight paired cases use real loopback sockets: empty/1/4/16
bytes, each with writable/readonly authority, fragmented input and peer EOF.
Independent output oracles verify the sum and no readonly output. Bounds,
sparse JS input, busy release and retired access reject. No general memory,
untrusted thread, reset/revocation/cancellation, sustained resident server,
UDP/HTTP/TLS or browser/mobile qualification is claimed. TLS belongs in a
reviewed Lib over transport; this fixture provides no encryption. Local PASS
and exact-source Actions acceptance are distinct, and old tags are unchanged.
