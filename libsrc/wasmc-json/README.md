# wasmc-json — public source candidate

This is a clean-room public implementation of the WIT contract embedded in the
frozen HTTPS JSON qualification artifact.

It deliberately has **zero Host imports**. JSON parsing, validation, RFC 6901
pointer selection and compact serialization are portable Lib semantics and do
not belong in Host providers.

The frozen `host/tests/https/artifacts/json.wasm` is used only as a behavior and
contract oracle. It is not source provenance and byte identity is not required.

The implementation uses public Rust crates (`serde_json` and `wit-bindgen`) with
a locked dependency graph. Resource-boundary values remain an explicit
qualification item; changing them is Lib policy, not a Host ABI change.

This candidate is not yet an admitted `libs/` package.
