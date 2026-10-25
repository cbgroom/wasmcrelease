---
name: wasmc-lib-discovery
description: Find exact current WAsmC package/API implementations before writing algorithms or data operations; select complete digest-bound Roots and verify actual behavior.
metadata:
  parent_skill: "wasmc-lib"
---

# Library-first discovery

Use the v0.0.24 product's `catalog/libs-current-v2.json`, independently pinned
below. It binds42 complete current package Roots, including14 native-source
packages. LibSearch0.5.0 executes lookup and bounded search over42 package and
247 API routes. A search result establishes discovery; channel authorities
establish release. Native-source delivery does not establish executable or
physical-device support.

## Find an implementation

Run from the verified immutable product or tooling root:

```sh
node scripts/wasmc-lib.mjs search "base64 decode" --catalog-sha256 86981ab84b16cc06684dc87da28c436b190d79c8c9c312ffa7f27206e444cb5a --limit 8
node scripts/wasmc-lib.mjs search "counter" --catalog-sha256 86981ab84b16cc06684dc87da28c436b190d79c8c9c312ffa7f27206e444cb5a --limit 8
```

The first query returns identity
`wasmc-std@1.4.1/base64#try-decode-standard` and WIT route
`wasmc:std@1.4.1/base64#try-decode-standard`. The response has schema
`wasmc.public-current-lib-search/v3` and `result.tag=ok`; results are in
`result.value`. Each hit contains identity, package_id, version, profile,
source_path, wit_route and exact delivery pins. Read the corresponding catalog
row's `root`, then its pinned `lib.json`, Skill and WIT. Relative artifact paths
belong to that Root. Do not infer old hit fields or reconstruct an SDK path.

All query tokens must match with ASCII case folding and stable identity order.
Use explicit `--offset N --limit N` pagination, at most64/page. Package/profile
and bound-only filters are explicit. No match describes this finite index.
Use shorter concrete words or read the exact target WIT before writing missing
bounded glue. Search does not choose versions or grant semver fallback.

## Select and execute

1. Select the exact package version, catalog digest, manifest digest and
   complete Root inventory digest under the caller's instruction or policy.
   `resolve` requires all three independent digests and mechanically verifies
   the complete packaged Root. Its `verified=true` reports byte verification;
   `authority_granted=false` and `engine_admission=separate` remain explicit.
   Search, resolution and behavior checks do not grant caller approval. Carry
   out the requested read-only verification and report approval separately.
   The selected Root binds WIT, Core/Component or native-source view,
   generated SDK, agent metadata, licenses and original notices.
2. Install only with an independently approved lock digest and explicit mirror.
   Installation preserves complete bytes and rejects an occupied destination.
   Use the documented current commands; immutable older catalogs are historical
   authorities for their own artifacts.
3. Check the Root's delivery kind, runtime profile and every actual import.
   Std1.4.1 Core requires the exact Provider4.9.1 module (ABI namespace4.9.0). Installation supplies no
   Host permission. Core, Component, native-source and device evidence differ.
4. For Base64 run [the actual behavior oracle](../../examples/base64/run.mjs).
   It checks encode/decode, invalid input and explicit resource cleanup on the
   pinned Std1.4.1/Core4.9 bytes. Its default invocation uses the packaged Root
   and reports `installed_root_verified=false`; it proves no installation.
   The documented `--installed` form verifies the actual installed directory
   separately. Report the exact package and WIT APIs, resolver verification and
   observed output. Read `release.json` and `channels/prod.json` before stating
   release or installation-route availability. An installable route is not
   evidence that this task installed the package.

Missing identity, digest drift, unsupported engine or capability blocks that
route. Never invent private handles, hidden effects or third-party publication.
