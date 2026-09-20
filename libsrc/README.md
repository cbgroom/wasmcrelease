# Public Lib source

`libsrc/` is the mutable public-source side of the WAsmC Lib ecosystem.

It is intentionally separate from `libs/`, which contains admitted release
products. A source tree may change through ordinary review; an admitted Lib
version is immutable and digest-bound.

## Design law

**Host-thin, Lib-rich.**

Keep only irreducible effects in Host providers. Move portable parsing,
protocols, codecs, compression, routing, transforms and policy into import-free
Core Wasm Libs whenever possible. When a Lib needs Host authority, bind it at
the thinnest layer and do not propagate provider/platform identity upward.

See `docs/LIB_GRADUATION.md` and `CONTRIBUTING.md`.

`registry.json` records incubation state. It is not the release catalog and
does not make candidates discoverable through production LibSearch.

Each source package may carry its own Cargo workspace boundary so it can be
built and reviewed independently from the release repository's maintenance
workspace. Public-source CI rebuilds candidates from locked dependencies rather
than committing local target artifacts.
