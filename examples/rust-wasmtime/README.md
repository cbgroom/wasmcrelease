# Rust + Wasmtime demo

Run `cargo run --locked` or `cargo test --locked` in this directory.

The demo uses plain Wasmtime 47.0.3. It compiles a WAsmC source through the
published compiler Core Wasm, executes the generated module, then validates
and initializes the matching import-free FastAPI Core 4.3 provider. It creates
a fresh `Store` for each operation and grants no filesystem, network, clock,
randomness, process, secret, or device imports to guest modules.

This is executable reference code, not a stable Rust SDK API. The preview does
not yet expose a general managed-source-to-FastAPI-bundle compiler entrypoint.
