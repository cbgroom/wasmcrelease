# Releases

Packages are built and verified locally from clean synchronized private source, then pushed directly. GitHub Actions cannot rebuild the compiler and is not required.

## v0.0.3

First release of the current architecture: lowercase `wasmc`, WIT-authoritative Lib identity, `compileLib`/`instantiateLib`, managed String/List/Map/record support, stateful resource and explicit Host-import Component examples, developer/per-Lib Skills, and a locked Rust/Wasmtime journey. It is built from private source commit `421aaa33f2d340c312f394a8c0cf5c95a9ad186c`.

The immutable identity is tag `v0.0.3`. `package-index.json.latest` moves to `0.0.3`; old `v0.0.1` and `v0.0.2` tags remain unchanged.

## v0.0.2

Added the first public language guide and executable Agent examples. Its public FastAPI provider was prebuilt but did not expose a complete managed-source facade.

## v0.0.1

Initial compiler, JavaScript facade, provider bytes, manifest, checksums, and Rust demo.

All `0.0.x` releases are intentionally not 1.x-stable. Publisher signing and automatic update/rollback are not provided.
