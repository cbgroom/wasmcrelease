# Release process

Packages are built and verified locally from the private WAsmC source
authority. GitHub Actions is not required and this repository cannot rebuild
the compiler.

A version becomes available only after fixed repository files, an immutable
SemVer tag, SHA-256 verification, and independent jsDelivr tests pass for the
raw compiler Wasm, JavaScript sidecar, and Rust Wasmtime demo. Production URLs
must pin an exact tag or full commit. `latest`, unversioned, range, and branch
URLs are mutable discovery conveniences and must not be used as reproducible
identities. GitHub Releases are convenience mirrors. Wasmtime
AOT files, when supplied, are target-bound caches and never replace the
portable compiler Wasm identity.

Rust integration is a complete executable Cargo demo with a pinned Wasmtime
dependency and behavior test, not a WAsmC SDK or published crate API.

## v0.0.1

This is the first formal initial-development release. It publishes compiler and
FastAPI Core 4.3 bytes atomically with the JavaScript facade, Rust Wasmtime
demo, manifest, provenance, checksums, and Agent integration guide.

The immutable identity is `v0.0.1`. `package-index.json` records `0.0.1` as
`latest`; a later `v0.0.2` will preserve `v0.0.1` and move only that mutable
index pointer. Version `0.0.1` does not claim stable APIs, publisher signing,
automatic update/rollback, or a general managed-source product compiler.
