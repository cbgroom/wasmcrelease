# Release process

Packages are built and verified locally from the private WAsmC source
authority. GitHub Actions is not required and this repository cannot rebuild
the compiler.

A version becomes available only after immutable GitHub Release assets,
SHA-256 verification, and independent public-download tests pass for the raw
compiler Wasm, JavaScript sidecar, and Rust Wasmtime SDK. Wasmtime AOT files,
when supplied, are optional target-bound caches and never replace the portable
compiler Wasm identity.
