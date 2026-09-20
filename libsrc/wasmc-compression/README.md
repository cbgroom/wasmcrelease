# wasmc-compression — public source candidate

This is a clean-room public implementation of the gzip WIT contract embedded in
the frozen HTTPS compression qualification artifact.

It has **zero Host imports**. Compression and decompression are portable Lib
semantics. The implementation uses public Rust crates with a locked dependency
graph.

The frozen `host/tests/https/artifacts/compression.wasm` is a contract and
behavior oracle only. It is not source provenance. Representative compression
outputs are byte-for-byte equal to the oracle, including deterministic gzip
header fields.

Resource-boundary calibration and multi-engine admission remain explicit
follow-up gates. This candidate is not yet an admitted `libs/` package.
