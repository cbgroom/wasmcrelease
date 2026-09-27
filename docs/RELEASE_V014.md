# WAsmC v0.0.14 LibSearch route-complete release

v0.0.14 adds the admitted `wasmc-lib-search@0.2.0` package and its exact
release catalog. The final frozen v2 candidate contains 213 files with product
set SHA-256
`a09cd071eb293e636bf8b858b0a56570bfdd8a53373544eca68fda8ea825d4d2`.

The release closure binds all 14 package routes and 108 exported WIT API routes
with `candidate_extras=0`. LibSearch 0.2.0 has an import-free 53,412-byte Core
artifact and a 55,178-byte Component artifact. Its 27,749-byte index contains
122 package/API entries. Historical LibSearch 0.1.0 remains in the catalog as a
historical exact version; it is not selected as the active route.

## Final qualification and promotion

The product candidate is frozen at
`6cb3aafea5334ac27648af0e9ccd684fe721ccb5`. The same commit is the tested
source for the versioned LibSearch workflow, Rust binding, Core export prefix,
Agent guidance and complete source-free consumer identity.

- LibSearch portable equivalence run `36285470123`: success across ten
  JavaScript runtime/platform cells, Wasmi 2 Core, Wasmtime 49 generated
  Component SDK and its required aggregate.
- Full source-free consumer run `36285471830`: success across compatibility,
  integrity, Agent guidance, both mirrors, Node/Bun/Deno journeys, security
  history and release-profile Rust/Wasmi/Wasmtime/Component Libs.
- SDK Agent guidance run `36285458201`: success on the frozen candidate commit.
- Host external HTTPS run `36285458207`: success on all five required platforms
  and the legacy-optional Intel macOS platform.

These receipts authorized `v0.0.14-dev.2`. The metadata-only transitions to
`v0.0.14-main.2` and `v0.0.14` preserve the candidate commit and every product
digest. Only the suffix-free prod tag advances public discovery.

## Superseded prereleases

White-box review of the first frozen candidate found that it contained
stage-specific Agent guidance: several product files still name v0.0.13 as the
current immutable release, and the quickstart tells Agents to stop at the dev
qualification gate. Publishing those exact bytes as v0.0.14 would preserve
hashes but teach a false lifecycle state. `scripts/validate-v014-prod-readiness.mjs`
therefore keeps prod fail-closed. The required recovery is a lifecycle-neutral
replacement lifecycle-neutral product set. Existing dev.1 and main.1 remain
immutable prerelease evidence and do not advance the public pointer. The
replacement completed dev.2, main.2 and prod without changing its product
digest set.
