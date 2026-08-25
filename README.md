# WAsmC release channel

Public binary packages and integration wrappers for the source-private WAsmC
compiler.

This repository is a distribution channel, not the compiler source or build
authority. Every version uses one standard Core Wasm compiler digest shared by
the raw Wasm, JavaScript sidecar, and executable Rust Wasmtime demo. Immutable
repository tags are also served through jsDelivr's GitHub CDN.

`main` currently carries an untagged preview candidate containing the canonical
compiler Core Wasm, the matching import-free FastAPI Core 4.3 provider, a small
JavaScript facade, and a complete plain-Wasmtime Rust demo. Pin a full commit
and verify `SHA256SUMS`; `main` is mutable and is not a production version.

No stable compiler version has been published yet. See
[RELEASES.md](RELEASES.md) for admission and [package-index.json](package-index.json)
for accepted versions.
