# Public Lib discovery and exact resolution

These supplemental source-free tools live on commits after v0.0.9, not in its
immutable tag. Pin a full tooling commit, verify SHA256SUMS, then run from that
checkout. Existing compiler, Lib roots and historical trees are unchanged.

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

`search` is case-insensitive all-token matching of identity and finite reviewed
keywords, with stable identity ordering. It returns no relevance-based version
winner. Current search returns the standard Lib only; `--historical` includes
the three frozen qualification Libs. This is package discovery, not inferred
mapping from arbitrary Rust APIs or natural-language tasks.

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
