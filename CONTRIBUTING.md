# Contributing to WAsmC public Libs

This repository is a source-free compiler delivery boundary **and** a public
home for independently maintainable Lib source.

Compiler/CoreLib producer source remains private. Public Lib source under
`libsrc/` is intentionally different: contributors may propose, implement,
test, review and evolve reusable Libs here.

## The boundary

- `libsrc/` — public source incubation and maintenance.
- `libs/` — admitted immutable Lib products for a release identity.
- `host/` — irreducible external effects and provider/runtime machinery.
- `catalog/` and LibSearch — discovery of admitted packages, never admission
  by themselves.

Do not edit an admitted `libs/<id>` package as if it were mutable source.
Change public source, qualify a candidate, then admit a new exact version.

## Thin Host rule

A Lib may depend on Host capabilities only for effects that cannot be expressed
as portable Core Wasm. Protocols, codecs, parsers, compression, routing,
algorithms, retry/cache policy and similar reusable logic belong above the Host
boundary whenever possible.

A contribution that adds a Host primitive must first show why the behavior
cannot live in an import-free Lib or in a Lib over an existing capability.

## Contribution loop

1. Start from `libsrc/registry.json` or add a new incubator entry.
2. Define the public WIT/API before implementation details.
3. Declare every Host import. Prefer zero imports.
4. Build/test the public source without private compiler source.
5. Add behavior, negative and compatibility tests.
6. Run `node scripts/validate-libsrc.mjs`.
7. For Host-graduated work, compare against the pinned behavior oracle without
   treating byte identity as the goal.
8. For a new native-public Lib, record the mature implementation basis in
   candidate metadata and qualify the public semantics directly; a historical
   Host oracle is not required.
9. Submit the source, tests, WIT, metadata and evidence together.

For data-processing Libs, also read `docs/DATA_ECOSYSTEM.md`. Prefer mature
Rust implementations behind a small stable WIT facade rather than copying
third-party Rust types into the public ABI.

Passing incubation does not publish a Lib. Admission into `libs/`, catalog
selection and release promotion remain separate reviewed gates.
