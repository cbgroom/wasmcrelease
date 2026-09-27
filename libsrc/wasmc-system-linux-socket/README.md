# Linux socket system Lib

Unreleased Linux system Lib prototype. It owns IPv4 TCP socket, bind, listen,
connect, accept, stream read/write, readiness polling, half-close and native FD
lifetime above the same fixed native boundary executor used by the Linux VFS
endpoint Lib.

Socket addresses, TCP semantics and Linux syscall details are Lib-owned. The
fixed Rust executor loads an exact digest-bound adapter and exchanges bounded
byte frames; it contains no network API, address, socket constant or protocol
branch.

Qualification binds loopback on an ephemeral port, connects and accepts a real
TCP stream, checks both endpoint identities, transfers bytes in both directions,
observes readiness, exercises write half-close, rejects stale generation tokens
and retains a bounded throughput floor. This is the physical transport slice for
the later HTTPS migration. It does not yet prove TLS/HTTP execution through this
adapter, async Completion bridging, non-Linux sockets, admission or release.
