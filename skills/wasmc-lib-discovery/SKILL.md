---
name: wasmc-lib-discovery
description: Find released WAsmC package/API implementations before writing algorithms or data operations; interpret embedded Wasm search hits and proceed to exact selection and verified execution. Not third-party authoring or private compiler maintenance.
metadata:
  parent_skill: "wasmc-lib"
---

# Library-first discovery

## Candidate branch status

Immutable `v0.0.12` remains the released prod identity and its original
LibSearch snapshot is unchanged. This development branch carries an **unreleased
LibSearch 0.2.0 candidate** that remediates the business feedback gap by indexing
the complete v0.0.12 published Lib set. Do not describe 0.2.0 as shipped until a
later release admits it.

The candidate search snapshot covers 13 packages including itself / 117
package+API entries. Business regressions require `csv`, `wasmc-csv`,
`equi-join`, `wasmc-data-relational`, `parquet`, `wasmc-host-clock`,
`resource counter`, and `owned algorithms` to resolve to their exact package
or API identities.

This is supplemental guidance after immutable v0.0.10. Pin the tooling full
commit and verify its SHA256SUMS; do not assume mutable main is release identity.
Search, exact resolve and pinned install shipped in v0.0.10, despite older
parent/catalog wording describing them as supplemental main tooling.

## Find an implementation

Run from the verified release/tooling root. Use concrete API/domain words,
not an assumption of natural-language or Rust-symbol inference:

```sh
node scripts/wasmc-lib.mjs search "base64 decode" --limit 8
node scripts/wasmc-lib.mjs search "counter" --historical --limit 8
```

The first query returns `wasmc:std@1.4.0/base64#try-decode-standard`.
Each `hit` contains `identity`, `signature`, `skill_path`, `wit_path` and
`artifact_path`. Paths are relative to this pinned release root. Package hits
have an empty signature; API hits include the WIT signature. Read the target
Skill and WIT before generating glue. Do not construct handles from a signature.
Resource API identities may include `[constructor]` or `[method]`; use the
ordinary WIT resource and generated binding, not an invented source call name.

All query tokens must match; ASCII case folding only, stable identity order,
no relevance score. Empty query lists entries. Use `--offset N --limit N` for
paging (maximum64/page). Historical qualification packages require
`--historical`. No hit means no match in this finite snapshot, not proof that
no implementation exists anywhere. Retry a concrete shorter term, then inspect
the target WIT; if still absent, write missing bounded glue or report the gap.
See [search semantics and typed JS/Rust APIs](../../examples/lib-search/README.md).

## Select and execute, separately

1. Approve an exact package version and catalog/WIT/artifact digests from the
   pinned package metadata. A search hit or newest-looking version is not trust.
2. Use [exact resolution](../../catalog/README.md) and
   [no-clobber installation](../../catalog/INSTALL.md). Legacy callers default
   to the immutable v0.0.9 four-package catalog. This candidate additionally
   supports an explicit `--catalog v012` authority containing 12 packages,
   including Data Foundation. The caller still pins catalog/WIT/artifact
   digests; search never becomes selection authority.
3. Check [artifact compatibility](../../compatibility/README.md), matching
   CoreLib/provider identity and actual import authority. Installing bytes
   does not admit an engine or grant capabilities. Search runs on Wasmi/Node18;
   existing Std1.4.0 does not, because its artifact features differ.
4. Execute the package's supported example and check the oracle before adding
   App control logic. Report the pinned source, exact API, profile/engine and
   observed output. Keep Core and Component verification separate.

Missing exact identity, digest drift or unsupported engine is a stopping
condition, not permission for semver fallback, raw handles, hidden Host calls
or pretending third-party build/publish is available.
