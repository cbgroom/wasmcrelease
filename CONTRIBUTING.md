# Contributing to WAsmC public Libs

This repository is a source-free compiler delivery boundary **and** a visible
home for independently maintainable Lib source.

## External contributions are paused

External code and documentation contributions are not currently accepted while
the project defines its contributor-licensing terms. Issues, research reports,
and reproducible observations are welcome, but do not submit a pull request
containing code or other copyrightable material unless the repository owner has
first provided written contribution terms.

Opening a pull request does not transfer copyright and does not grant the
project or any user additional rights. Repository use remains governed by the
[Research-Only Non-Commercial License](LICENSE).

Compiler/CoreLib producer source remains private. Public Lib source under
`libspec/` is intentionally different: once contribution terms are published,
contributors may be invited to propose, implement, test, review and evolve
reusable Libs here.

## The boundary

- `libspec/` — public source incubation and maintenance.
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

## Maintainer contribution loop

1. Start from `libspec/registry.json` or add a new incubator entry.
2. Define the public WIT/API before implementation details.
3. Declare every Host import. Prefer zero imports.
4. Generate packages with the explicitly pinned producer; test those exact package receipts, without private compiler source.
5. Add behavior, negative and current semantic and negative tests.
6. Run `node scripts/validate-current-only-libs.mjs && node scripts/validate-lib-refresh-v2-source.mjs`.
7. For Host-graduated work, compare against the pinned behavior oracle without
   treating byte identity as the goal.
8. For a new native-public Lib, record the mature implementation basis in
   candidate metadata and qualify the public semantics directly; a historical
   Host oracle is not required.
9. Maintainers submit the source, tests, WIT, metadata and evidence together.

For data-processing Libs, also read `docs/DATA_ECOSYSTEM.md`. Prefer mature
Rust implementations behind a small stable WIT facade rather than copying
third-party Rust types into the public ABI.

Passing incubation does not publish a Lib. Admission into `libs/`, catalog
selection and release promotion remain separate reviewed gates.
