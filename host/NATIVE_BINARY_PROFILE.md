# Binary-only default Native reference

The public mutable `host/tests/e2e/rust` reference accepts binary Core Wasm.
It does not offer WAT source compilation. The frozen compiler, CoreLib and
Runtime SDK are untouched. Wasmi remains pinned to2.0.0; its explicit features
retain stable/std/validate/memory64/auto-dispatch and omit only wat.

The unit contract accepts a binary empty Core module and rejects WAT text and
malformed binary sections. Every actual App/Lib remains digest-checked by its
own harness. Removing text parsing does not remove admission, engine validation,
fuel or ownership/error controls. Optional Wasmtime is unchanged and its graph
is qualified separately; this document does not ban optional-engine tooling.

Local macOS arm64, Rust1.96.0, release profile, same `udp-server-reference`:

| Default reference | File bytes | Unique dependency packages |
| --- | ---: | ---: |
| Before removing WAT | 3634784 | 27 |
| Binary-only | 2643840 | 21 |

This is a local build observation, not a cross-platform size guarantee or
performance threshold. File size includes native executable/runtime; it is
not compiler Wasm size. Default and optional engine real UDP/TCP regressions
must pass independently. Mobile compile checks reject default Wasmtime/WASI/
TLS/WAT dependencies; compile success is not device/network qualification.

Reproduce from repository root:

```
cargo build --release --locked --manifest-path host/tests/e2e/rust/Cargo.toml --bin udp-server-reference
cargo tree --locked --manifest-path host/tests/e2e/rust/Cargo.toml --prefix none --format '{p}'
cargo test --locked --manifest-path host/tests/e2e/rust/Cargo.toml --lib
```

Resolve exact source using Git and containing workflow SHA; do not apply this
mutable profile retroactively to an immutable tag. No new Host import/API,
automatic engine promotion, producer rebuild or release is introduced.
