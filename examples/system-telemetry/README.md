# Telemetry consumer qualification

Candidate tooling, not a prod installation command. The Rust consumer uses
generated Wasmtime bindings from the public WIT and a supplied Component only;
it never links telemetry implementation source. It exercises construction,
drop, cache freshness, counter deltas, atomic failures, missing input, backwards
time and double drop. Its first local probe reused exact warm Wasmtime49
dependencies with matching panic=abort; this is not a clean Cargo multi-OS build.

Copy the exact candidate lib.wit to consumer/wit/world.wit and verify its digest.
Build using `cargo build --release --locked --manifest-path consumer/Cargo.toml`.
Run `telemetry-consumer /absolute/path/to/component.wasm`.

The standard wit-component encoder constructs the Component from the resource
guest. Raw Core imports include Canonical resource new/drop intrinsics, not
ambient Host permissions. Do not instantiate raw Core bytes without a correct
resource manager or teach private pointers/handles as an Agent API.

Formal release still requires WAsmC consumption, source-bound cross-platform
qualification, strict package/discovery gates and immutable promotion.
