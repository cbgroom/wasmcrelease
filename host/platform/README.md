# Platform boundary executors

The target platform layer executes the fixed, domain-neutral native boundary.
Public file, process, network, protocol and device semantics belong to Lib WIT;
their physical mappings belong to the matching Lib descriptors.

`profile-resolver.mjs` resolves a requested platform-neutral API graph against
the exact `system_binding` metadata owned by the supplied Lib candidates. It
matches `os`, `architecture`, `environment` and `embedding`, enforces lifecycle
state and the boundary identity, and requires one result per API. Zero matches
and ambiguous matches fail closed; ambiguity can only be resolved by an exact
provider pin. Provider names are never parsed to infer platform support.

This is deployment control-plane selection, not a Host domain inventory. The
resolver only sees candidate paths explicitly supplied by a profile request.
Adding macOS, Windows or iOS therefore adds Lib candidates and target requests,
not Host APIs or rows in the retained legacy provider matrices.

The existing `providers.json` files retain v0.0.15 qualification evidence only.
They are not a canonical capability inventory and must not gain new domain
rows. See `PROVIDER_MODEL.md` and
[`docs/HOST_LIB_DEFINED_BOUNDARY.md`](../../docs/HOST_LIB_DEFINED_BOUNDARY.md).
