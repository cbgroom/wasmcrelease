# Platform boundary executors

The target platform layer executes the fixed, domain-neutral native boundary.
Public file, process, network, protocol and device semantics belong to Lib WIT;
their physical mappings belong to the matching Lib descriptors.

`profile-resolver.mjs` resolves a requested platform-neutral API graph against
the exact `native.binding` metadata owned by the supplied current Lib sources. It
matches `os`, `architecture`, `environment` and `embedding`, enforces lifecycle
state and the boundary identity, and requires one result per API. Zero matches
and ambiguous matches fail closed; ambiguity can only be resolved by an exact
provider pin. Provider names are never parsed to infer platform support.

This is deployment control-plane selection, not a Host domain inventory. The
resolver only sees candidate paths explicitly supplied by a profile request.
Adding macOS, Windows or iOS therefore adds current Lib sources and target requests,
not Host APIs or rows in the retained legacy provider matrices.

`embedding` distinguishes code executing inside a target from a development
supervisor controlling that target. The iOS Simulator display slice uses
`supervisor`; it must not be treated as an iOS app or physical-device binding.

The existing `providers.json` files retain v0.0.15 qualification evidence only.
They are not a canonical capability inventory and must not gain new domain
rows. See `PROVIDER_MODEL.md` and
[`docs/HOST_LIB_DEFINED_BOUNDARY.md`](../../docs/HOST_LIB_DEFINED_BOUNDARY.md).
