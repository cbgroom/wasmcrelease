# Legacy provider evidence and future boundary execution

The platform `providers.json` files describe retained v0.0.15 domain evidence.
They are frozen migration inputs, not the capability model of the next Host.

## Future rule

New domains are exact Lib packages. WIT owns their public semantics and the
matching Lib owns a platform native boundary descriptor. The fixed Host
platform layer executes descriptors without acquiring the domain API.

Consequently:

- there is no canonical Host domain list;
- a new domain must not add a provider row;
- a new domain must not add Rust/JavaScript Host methods;
- platform selection is expressed by the exact Lib graph and descriptor;
- local and remote implementations are Lib choices above one fixed boundary.

## Exact target resolution

Every selectable system current Lib source owns a `native.binding` record declaring
the platform-neutral API it implements, the fixed boundary version, its native
descriptor, exact target tuples and five independent lifecycle states. The
target tuple is `{os, architecture, environment, embedding}`; in particular,
iOS device and iOS simulator are different targets.

The package set is an explicit input to `profile-resolver.mjs`, so it does not
recreate a global Host capability registry. Resolution is metadata-based and
never parses provider names. For each requested API it requires one exact
target, boundary and lifecycle match. Missing matches reject instead of falling
back across platforms. Multiple matches reject unless the request supplies the
exact provider identity as a pin.

## Retained v0.0.15 evidence

Existing rows keep their historical three-state meaning:

- `unimplemented`: no retained v0 provider implementation was claimed;
- `implemented`: retained provider code existed without complete evidence;
- `qualified`: retained provider code and its declared workflow existed.

These rows may be corrected only to repair historical evidence. They must not
grow to represent a new feature. Qualification of the target architecture is
instead expressed as:

```text
exact Lib identity
+ exact WIT identity
+ exact native descriptor identity
+ exact unchanged Host identity
+ cross-engine behavior and lifecycle evidence
```

The decisive migration test is adding file, process and network behavior with
one byte-identical Host binary and no new Host domain APIs.
