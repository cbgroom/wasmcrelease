# Platform boundary executors

The target platform layer executes the fixed, domain-neutral native boundary.
Public file, process, network, protocol and device semantics belong to Lib WIT;
their physical mappings belong to the matching Lib descriptors.

The existing `providers.json` files retain v0.0.15 qualification evidence only.
They are not a canonical capability inventory and must not gain new domain
rows. See `PROVIDER_MODEL.md` and
[`docs/HOST_LIB_DEFINED_BOUNDARY.md`](../../docs/HOST_LIB_DEFINED_BOUNDARY.md).
