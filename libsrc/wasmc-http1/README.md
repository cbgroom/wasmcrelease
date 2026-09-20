# wasmc-http1 — public source candidate

This is a clean-room public implementation of the HTTP/1 wire contract embedded
in the frozen HTTPS qualification artifact.

It has **zero Host imports**. Request-head parsing, framing decisions and response
head serialization are protocol semantics and therefore belong in a portable
Lib rather than Host providers.

The frozen `host/tests/https/artifacts/http1-server.wasm` is used only as a
contract and behavior oracle. It is not source provenance. The public
implementation uses the open `httparse` crate with a locked dependency graph.

Representative Component-level qualification covers HTTP/1.0 and HTTP/1.1,
Content-Length framing, incomplete bodies, rejected chunked framing, malformed
syntax and response serialization. Resource-boundary calibration and broader
status/header coverage remain explicit admission gates.

This candidate is not yet an admitted `libs/` package.
