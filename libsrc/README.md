# Public Lib source

`libsrc/` is the mutable public-source side of the WAsmC Lib ecosystem.

It is intentionally separate from `libs/`, which contains admitted release
products. A source tree may change through ordinary review; an admitted Lib
version is immutable and digest-bound.

## Design law

**Host fixed and domain-neutral; Libs define the system.**

The Host owns only target/resource/window/operation/completion mechanics. Exact
Lib WIT owns domain semantics and the matching exact Lib package owns its native
boundary descriptor. File systems, processes, networks, services and devices
must grow through Libs rather than Rust/JavaScript Host API families. Portable
parsing, protocols, codecs, routing, transforms and policy remain higher Libs.

See `docs/LIB_GRADUATION.md` and `CONTRIBUTING.md`.

`registry.json` records incubation state. It is not the release catalog and
does not make candidates discoverable through production LibSearch.

Candidates may be either Host-graduated (with a pinned behavior oracle) or
native-public (new public Libs qualified directly from their reviewed
semantics). Data-processing contributors should also read
`docs/DATA_ECOSYSTEM.md`.

System Lib prototypes may additionally carry `native-boundary.json` and a
digest-bound platform adapter. These are physical binding source owned by the
Lib, not admitted artifacts or permission to extend the Host API.

New cross-platform System Lib providers use the canonical layout described by
`host/contract/system-lib-package.json`: platform-neutral semantics in
`lib.wit`, package lifecycle and target metadata in `candidate.json`, and all
OS-specific binding metadata/source below `platform/<os>/`. A qualification App
or harness consumes that package; it must not become the owner of provider
source. Dynamic native adapters and statically linked mobile providers use the
same target resolver through the `native-adapter` and `embedded-source`
artifact formats respectively.

Each source package may carry its own Cargo workspace boundary so it can be
built and reviewed independently from the release repository's maintenance
workspace. Public-source CI rebuilds candidates from locked dependencies rather
than committing local target artifacts.
