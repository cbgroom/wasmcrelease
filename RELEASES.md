# Release process

Packages are built and verified locally from the private WAsmC source
authority. GitHub Actions is not required and this repository cannot rebuild
the compiler.

A version becomes available only after fixed repository files, an immutable
SemVer tag, SHA-256 verification, and independent jsDelivr tests pass for the
raw compiler Wasm, JavaScript sidecar, and Rust Wasmtime SDK. Production URLs
must pin an exact tag or full commit; unversioned, latest, range, and branch
URLs are forbidden. GitHub Releases are optional convenience mirrors. Wasmtime
AOT files, when supplied, are target-bound caches and never replace the
portable compiler Wasm identity.
