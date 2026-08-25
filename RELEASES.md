# Release process

Packages are built and verified locally from the private WAsmC source
authority. GitHub Actions is not required and this repository cannot rebuild
the compiler.

A version becomes available only after fixed repository files, an immutable
SemVer tag, SHA-256 verification, and independent jsDelivr tests pass for the
raw compiler Wasm, JavaScript sidecar, and Rust Wasmtime demo. Production URLs
must pin an exact tag or full commit; unversioned, latest, range, and branch
URLs are forbidden. GitHub Releases are optional convenience mirrors. Wasmtime
AOT files, when supplied, are target-bound caches and never replace the
portable compiler Wasm identity.

Rust integration is a complete executable Cargo demo with a pinned Wasmtime
dependency and behavior test, not a WAsmC SDK or published crate API.

## Main preview

The default branch may carry one untagged candidate before formal release.
Consumers must pin its full commit and verify checksums. A main candidate does
not enter the stable `versions` list and makes no compatibility, signing,
automatic-update, or rollback claim. The current candidate publishes compiler
and FastAPI bytes atomically, but general managed-source product compilation is
not part of the public compiler ABI yet.
