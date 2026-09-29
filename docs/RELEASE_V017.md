# WAsmC v0.0.17 Lib closure release

v0.0.17 carries forward the v0.0.16 compiler, CoreLib, SDK, thin Host contract
and incubating Client/Gateway bytes. It adds three formally routed Lib package
identities without extending the Host API:

- `wasmc:data-relational@0.0.2`: stable whole-row/keyed `distinct` plus aligned
  `lag`/`lead`, with all prior relational operations regressed;
- `mcpgit:resident-memory@0.1.0`: the qualified source-free resident-memory
  query package;
- `wasmc:lib-search@0.3.0`: an import-free embedded snapshot that binds every
  v0.0.17 package and exported WIT API route.

The release catalog contains 17 exact package roots. Older relational and
LibSearch versions remain addressable as historical identities; they are not
overwritten. Resolution and installation require exact catalog, WIT and
artifact digests.

LibSearch 0.3.0 is produced from the caller-pinned 16-package input catalog,
adds its own source-bound WIT identity, and embeds 17 packages / 145 entries.
Two independent builds using the exact build-tool commit and Rust fingerprint
are byte-identical. Exact Core execution passes Wasmi 2.0 and the generated
Component SDK executes 403 Wasmtime calls. The package has zero Core imports
and grants no Host, selection or admission authority.

The fixed Host API remains unchanged. The Client/Gateway runtime stays an
incubating higher-layer product surface rather than a catalog Lib. Other
`libsrc` entries remain technical candidates until their own qualification and
admission gates close; v0.0.17 does not relabel them as published.

Promotion follows dev → main → suffix-free prod with one unchanged v2 product
set. The final prod tree requires exact-candidate CI, two-model Pi pre-release
acceptance, immutable tags and synchronized catalog/search/install routes.
