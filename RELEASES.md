# Releases

Packages are built and verified locally from clean synchronized private source, then pushed directly. GitHub Actions cannot rebuild the compiler and is not required.

## v0.0.5

Additive Runtime/Registry bootstrap release. It introduces `runtime/wasmc-runtime-v0` with the current 1,484,773-byte Core compiler (`c96ee185...bcbd3b`), thin Node/Bun/Deno adapters, package receipts, and `runtime/registry-v0` without npm or another external JavaScript package registry. Active public maintainer tooling is also Python-free.

The established v0.0.4 `dist/`, `package/`, and `libs/` trees are preserved byte-for-byte rather than being silently rebuilt. The new runtime artifact comes from private source commit `62e33753f8c89ebba353f974c47beafac7921997`; compatibility bytes remain rooted in immutable public v0.0.4 commit `573dda3b5fd771596814f5546923974b9fc9cbd5`.

The immutable identity is tag `v0.0.5`. `package-index.json.latest` moves to `0.0.5`; tags `v0.0.1` through `v0.0.4` remain unchanged.

## v0.0.4

Additive release of the integrated WIT/Lib/component architecture. The assembler now accepts an explicit additive `0.0.N` identity, Lib package fixtures close the formal release gate, activation-plan diagnostics remain fail-closed and labeled, and the managed-object Lib identity is pinned consistently. It is built from private source commit `b8344d65a942133f6af62b9a27093f50e2c22b79`.

The immutable identity is tag `v0.0.4`. `package-index.json.latest` moves to `0.0.4`; tags `v0.0.1` through `v0.0.3` remain unchanged.

## v0.0.3

First release of the current architecture: lowercase `wasmc`, WIT-authoritative Lib identity, `compileLib`/`instantiateLib`, managed String/List/Map/record support, stateful resource and explicit Host-import Component examples, developer/per-Lib Skills, and a locked Rust/Wasmtime journey. It is built from private source commit `421aaa33f2d340c312f394a8c0cf5c95a9ad186c`.

The immutable identity is tag `v0.0.3`. `package-index.json.latest` moves to `0.0.3`; old `v0.0.1` and `v0.0.2` tags remain unchanged.

## v0.0.2

Added the first public language guide and executable Agent examples. Its public FastAPI provider was prebuilt but did not expose a complete managed-source facade.

## v0.0.1

Initial compiler, JavaScript facade, provider bytes, manifest, checksums, and Rust demo.

All `0.0.x` releases are intentionally not 1.x-stable. Publisher signing and automatic update/rollback are not provided.
