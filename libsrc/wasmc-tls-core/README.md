# wasmc-tls-core — public source candidate

This is the thin-Host graduation sample for the first public Lib cohort.

The TLS protocol and connection state machine are implemented entirely in
portable Core Wasm using public Rust crates. The Guest-visible world imports
exactly one external capability: `entropy.fill`. Network transport, sockets,
reactors, file descriptors, platform identity and Host TLS APIs are deliberately
absent.

The current server profile does not import wall clock time. It disables TLS 1.3
session tickets and performs no client-certificate validation. Rustls receives a
Lib-local sentinel TimeProvider only to satisfy its portable no-std construction.
If a future feature genuinely requires authoritative wall time, that must be
introduced as a separately reviewed capability rather than silently expanding
this Lib's Host surface.

The frozen HTTPS TLS artifact is a behavior/architecture oracle, not source
provenance. This clean-room candidate is rebuilt from public source and qualified
with an independent Wasmtime Component host harness. The harness implements only
deterministic entropy and proves a real native-rustls client handshake, client to
server plaintext, server to client plaintext, graceful close and resource drop.

Current release Core Wasm is larger than the frozen oracle. Size optimization is
a follow-up performance task and is not allowed to weaken the one-import Host
boundary.

This candidate is not yet an admitted `libs/` package.
