# Releases

Packages are built and admitted locally from clean synchronized private source, then pushed directly. GitHub Actions independently verifies the source-free public consumer paths, but cannot rebuild or admit canonical compiler/Lib bytes and is not a publication dependency.

## v0.0.13

System Telemetry release. It adds the admitted source-free
`wasmc-system-telemetry@0.0.1` Lib for Rust Component and public
`wasmc-host` SDK consumers, including qualified real Linux acquisition
through explicitly granted read-only proc resources. It reuses the v0.0.12
compiler/runtime/SDK product bytes and does not add a telemetry-specific Host
callback, raw-handle escape hatch, Browser support, Wasmi Component support, or
real Windows/macOS acquisition. The frozen 194-file product set has SHA-256
`e2a1bb7e3bf30092ddda1313a9c20dd37a36e820b076bd64e0ac6ecec6ec36d0`.
The accepted sequence is `v0.0.13-dev.1` -> `v0.0.13-main.1` ->
`v0.0.13`; only the suffix-free prod release advances
`package-index.json.latest`.

## v0.0.12

SDK/Agent integration release. It publishes the generic Rust Host SDK,
SDK/Runtime/CLI Agent discovery Skills, release-surface authority and
cross-platform SDK qualification while preserving the admitted compiler and
Lib bytes. The immutable product candidate contains 188 products with
product-set SHA-256
`6c5da874b9a3cce2beef0936fa761c45d5e33869db165a30e3e2984622b7bb6b`.
The accepted sequence is `v0.0.12-dev.2` -> `v0.0.12-main.1` ->
`v0.0.12`; only the suffix-free prod release advances
`package-index.json.latest`. Native Runtime Library packaging remains
incubating and is not claimed by this release.

## v0.0.11

Data Foundation v1 adds seven admitted source-free packages: Data Core, CSV,
Expr, Compute, Relational, Data Profile and Data Interchange. Every Core
artifact has zero imports. The exact pipeline covers CSV through typed
validation, deterministic aggregation/join/union/ranking, profiling, Arrow IPC
and uncompressed Parquet. Exact-tag LibSearch and full consumer gates passed;
the compiler, Host ABI, lifecycle and no-replay contracts remain unchanged.
Lag/lead, frame aggregates and distinct are deferred to v1.1; SQL/DB is not
claimed. Product identity is retained in `channels/candidates/0.0.11.json`.

## v0.0.10

This release admitted the ordinary embedded-index LibSearch with exact package
resolution and pinned installation. It reused the qualified compiler and
standard Lib bytes. Complete scope is retained in `docs/RELEASE_V010.md`.

## v0.0.9

Latest compiler source authority is recorded in admission/compiler-build-v009.json.
The compiler is1351666 bytes, import-free. The current/ package and embedded
facades replace historical dist/ as the current compiler entrance. Compatibility
trees remain frozen. The source-free wasmc:std@1.4.0 package exposes73 semantic
APIs with generated Rust SDK; the 4.8 CoreLib deployment companion is outside
the strict package root. The package reuses its qualified producer bytes.

Node/Bun/Deno each pass30 frozen outputs,23 reconstructed expression cases,
192 managed-loop calls and5120 paired standard-Lib caller checks. Public
Wasmi/Wasmtime SDK tests pass18/18. Publication completed with coherent exact
same-archive Host receipts, integrity and a fresh all-ref credential scan.
All five exact-release Actions jobs passed. Complete testing instructions and
scope boundaries are maintained in [README.md](README.md).
Two historical raw scan findings are retained and narrowly classified only
under explicit authorization and exact decoded-artifact proof.

## v0.0.8

This additive release publishes `wasmc-core-runtime` as a reusable Rust SDK
with Wasmi-first completion, bounded optional Wasmtime promotion, exact
selected-backend no-replay semantics, request-local Host state, cancellation
and resource limits, and engine-neutral Core module inspection. The SDK bytes
are copied from and bound to private source authority
`bddf8a371698ac7f1ced87b02952df5be5359dad`.

The Runtime compiler product and the established v0.0.4 `dist/`, `package/`,
and `libs/` compatibility trees remain byte-for-byte unchanged. Node, Bun, and
Deno source-free execution, Fresh-Agent 100/100, strict Rust SDK tests, and
public integrity validation are rerun for the exact v0.0.8 candidate. Earlier
tags remain immutable.

## v0.0.7

This additive release advances only the Runtime/Registry and release evidence. The 1,488,174-byte compiler at SHA-256 `5e82679bd75b2da65d3f3c59069a98b72aaf64be18060797e2575ecc95495119` includes the WIT-shaped aggregate semantic baseline used by the paired Rust/wasmc App differential. Exact product commit `b6659654cdbfbc4c53a5eb92ca6d67db881c0491` is source-free executed under Node v26.5.1, Bun 1.3.14, and Deno 2.9.4; all pass self-test, 44-byte compile, validation, instantiation, and `run(6,18)=42`, while strict Fresh-Agent scores 100/100 with no findings.

The public v0.0.4 `dist/`, `package/`, and `libs/` trees remain byte-for-byte unchanged. The immutable identity is tag `v0.0.7`; `package-index.json.latest` moves to `0.0.7`, while tags `v0.0.1` through `v0.0.6` remain unchanged.

## v0.0.6

Fresh-Agent closure release. The additive Runtime compiler advances to 1,487,329 bytes at SHA-256 `44b87828c2b5b01631066cf1a2bc1246534f6d97a741a111437cd39caeb884f9`, preserves compiler-owned structured diagnostics, and derives bounded recordless String/List/Map managed roots without exposing internal plan authority. Node v24.15.0, Bun 1.3.14, and Deno 2.9.6 independently executed one exact source-free Runtime product candidate and passed self-test, 44-byte compile, WebAssembly validation, instantiation, and `run(6,18)=42`. Strict evidence rejects stale candidate identity and split archive identity.

The public v0.0.4 `dist/`, `package/`, and `libs/` trees remain byte-for-byte unchanged. v0.0.6 updates only additive Runtime/Registry, root Agent guidance, and public evidence/integrity metadata. The product bytes are rooted at private candidate `2b844a141bda2aaf5843b787cd649bfca558bce9`; the integrated release authority is private parent `5081fbba5af4e4231c1231e591a22271f59487ca`.

The immutable identity is tag `v0.0.6`. `package-index.json.latest` moves to `0.0.6`; tags `v0.0.1` through `v0.0.5` remain unchanged.

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
