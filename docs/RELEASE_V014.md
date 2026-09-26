# WAsmC v0.0.14 LibSearch route-complete release

v0.0.14 adds the admitted `wasmc-lib-search@0.2.0` package and its exact
future-product catalog. The frozen v2 candidate contains 213 files with product
set SHA-256
`0eb2d0addf9e0cfe9afb11502848bf0a09a55616c5024727ec98729103a138bc`.

The release closure binds all 14 package routes and 108 exported WIT API routes
with `candidate_extras=0`. LibSearch 0.2.0 has an import-free 53,412-byte Core
artifact and a 55,178-byte Component artifact. Its 27,749-byte index contains
122 package/API entries. Historical LibSearch 0.1.0 remains in the catalog as a
historical exact version; it is not selected as the active route.

## Dev qualification

The product candidate is frozen at
`f43dd8445717cc0dc38f41077ff239635b8e809d`. Qualification source
`7811eb769176d98d4c3f02fbd0a7beaa386ddf20` fixed and then exercised the
versioned LibSearch workflow, Rust binding, Core export prefix and full current
candidate identity.

- LibSearch portable equivalence run `36277853994`: success across ten
  JavaScript runtime/platform cells, Wasmi 2 Core, Wasmtime 49 generated
  Component SDK and its required aggregate.
- Full source-free consumer run `36277855490`: success across compatibility,
  integrity, Agent guidance, both mirrors, Node/Bun/Deno journeys, security
  history and release-profile Rust/Wasmi/Wasmtime/Component Libs.
- SDK Agent guidance run `36277334732`: success on the frozen candidate commit.
- Host external HTTPS run `36277334652`: success on all five required platforms
  and the legacy-optional Intel macOS platform.

These receipts first authorized `v0.0.14-dev.1`. The exact metadata-only
dev-to-main transition then preserved the candidate commit and every product
digest as `v0.0.14-main.1`. Neither prerelease publishes v0.0.14, advances
public default discovery, or permits rebuilding any product byte. Prod remains
v0.0.13 until its exact main-to-prod transition completes.
