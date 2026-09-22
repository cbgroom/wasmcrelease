# Public Lib discovery and exact resolution

## v0.0.12 catalog candidate

The immutable v0.0.9 resolver catalog remains the compatibility default.
This development branch adds a separate `catalog/libs-v012.json` snapshot
bound to immutable release commit
`735cc7fea762ba76f96d443cf64e47a31f8a1cc6`. It contains 12 published
packages and has SHA-256
`f2bbdb6c3cca31c16f7db96ca06ac94875c087e05c23c2aff979d46b90e463a3`.
It is candidate tooling for a future release, not a mutation of v0.0.12.

Example exact Data Foundation lock:

```bash
node scripts/wasmc-lib.mjs resolve wasmc-data-relational 0.0.1 \
  --catalog v012 \
  --catalog-sha256 f2bbdb6c3cca31c16f7db96ca06ac94875c087e05c23c2aff979d46b90e463a3 \
  --wit-sha256 91cfcf156c64f62099599b6a9f304639ba9845650363fc8bcef5d6b26cf1c8ef \
  --artifact-sha256 627176699ad4b9c2dc47ca78d520fe45ef1b2603fcc87d08eef3c0b2a1bf30a9
```

The resulting lock records release tag/commit and complete package file
inventory. No semver winner, capability grant, engine admission, or Host binding
is inferred.

Search, exact resolution and installation ship in v0.0.10, not immutable
v0.0.9. Pin the release or a full supplemental tooling commit and verify
SHA256SUMS before execution. The resolver catalog retains its exact four-package
v0.0.9 snapshot; this is distinct from the embedded five-package search index.

## Copy-run-change

```bash
node scripts/wasmc-lib.mjs search bytes
node scripts/wasmc-lib.mjs search --historical
node scripts/wasmc-lib.mjs resolve wasmc-std 1.4.0 \
  --catalog-sha256 13fe84e7faf77467b45d97460e9cd9fa1ba7d17c17b0175fb16ce5d694c82d82 \
  --wit-sha256 d565f00e91c36da68da3645ec5231dd11d1b25299a3ba5cbe3adbd9f5760d91d \
  --artifact-sha256 f8a8ce447f776a47680e02e19ea3a69827edbbc46e01985803ce3d3df51178d7
node scripts/test-lib-catalog.mjs
```

Bun runs the same scripts; Deno CLI uses `deno run --allow-read`.
The negative test harness additionally needs `--allow-write --allow-env=TMPDIR,TMP,TEMP`
for a temporary symlink fixture; these permissions are not granted to Apps.
The resolve receipt gives the verified exact root and file inventory. Continue
with that root's SKILL.md/WIT and [standard Host reference](../examples/current/standard.mjs).
Verify engine support separately using [Core compatibility](../compatibility/README.md).
Resolution never instantiates modules or grants capabilities.

`search` executes the embedded Wasm index and returns v2 package/API `hits`.
Matching is all-token with ASCII-only case folding and stable identity order,
not relevance ranking. The finite snapshot contains five packages/89 entries,
including search itself; `--historical` exposes frozen qualification entries.
See [Library-first workflow](../skills/wasmc-lib-discovery/SKILL.md) and
[precise search rules](../examples/lib-search/README.md). Search is not inferred
mapping from arbitrary Rust APIs or natural-language tasks, or a version winner.

`resolve` requires caller-owned catalog, WIT and Core artifact SHA-256 pins plus
exact id/version. Copying a search result is a discovery step, not proof of
publisher authenticity: approve/pin it independently. Missing candidates,
multiple candidates, digest drift, absent files and unsafe/escaping paths reject
with JSON codes. There is no semver range, latest preference or fallback.
All catalog-listed package files and the standard CoreLib companion are read
and digest-checked. This finite inventory is derived from already admitted
release manifests; it does not admit arbitrary third-party packages.

The companion is CoreLib, not a new public Lib dependency graph. A lock does
not fuse or automatically link modules, expose handles, or migrate ownership.
Core and Component remain distinct views; Core validation does not validate a
Component or authorize a Host import. This resolver is an offline public
delivery entrypoint, not a replacement compiler-side semantic resolver.

## Evidence and next stages

See [three-Host exact-harness evidence](../admission/public-lib-catalog-v009.json).
[Linux CI](https://github.com/cbgroom/wasmcrelease/actions/runs/34729685220)
passed seven JS/compatibility/integrity jobs, including catalog tests. Its full
Rust rebuild was still running at this checkpoint; read the live final status
before calling the whole run green.
Delivery closure has four distinct gates: compatibility, offline catalog/exact
resolve, pinned download/install, and public third-party build. First three are
implemented (3/4); authoring remains. See [pinned installation](INSTALL.md).
This is not an all-stdlib coverage
percentage, complete ecosystem readiness or a claim of Ultra/System completion.

`test-lib-catalog.mjs` resolves all four real packages twice with equal receipts
and tests ten rejection boundaries: wrong catalog digest, absent exact lock,
missing version, wrong WIT digest, ambiguity, traversal, altered artifact,
missing file, companion drift and symlink escape. Existing standard Host tests
remain the execution oracle; catalog verification alone proves no new behavior.

`refresh-lib-catalog.mjs` is a maintainer generator over an explicit approved
list, not public authoring. New packages require source-authority
admission and manifest review. Pinned download/install is now documented in
INSTALL.md; third-party build and publish remain next stages. Reuse existing private
exact-WIT/root machinery for authoring rather than adding language syntax or a
second allocator/ownership model.
