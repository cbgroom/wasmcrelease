# Release Lib search

## Admitted 0.4.0 v0.0.20 product candidate carrying the v0.0.18 snapshot

`standard/wasmc-lib-search/0.4.0` embeds the exact v0.0.18 route snapshot:
22 package identities / 162 package and API entries. It adds discovery for the
router-policy, JSON, compression, and HTTP/1 portable protocol Libs while
keeping 0.1.0 through 0.3.0 as historical identities.

- index: 39,094 bytes,
  `8513e628605e8ec05d76729a46fd7dc4427d64a83276368568ae05a0b9070eab`
- Core: 64,752 bytes,
  `3bfe9d15ee51832e884833b85ec09e3f803ef67b14f596ce6c168d9ffb1cf77f`
- Component: 66,518 bytes,
  `1d7019978645fa48c2da344010c8c9332f1f6ec159fef33e9c941a3aee29f2e9`

Two exact-tool builds are byte-identical. Wasmi 2.0 Core and Wasmtime 47.0.3
Component execution pass. The package has zero Core imports and grants no Host
or version-selection authority. Its admission receipt is
[`admission/lib-search-v040-v018-admission.json`](../../admission/lib-search-v040-v018-admission.json).

## Admitted 0.3.0 v0.0.17 product candidate

`standard/wasmc-lib-search/0.3.0` embeds the exact v0.0.17 route snapshot:
17 package identities / 145 package and API entries. It adds discovery for
`wasmc:data-relational@0.0.2` and `mcpgit:resident-memory@0.1.0` while keeping
0.1.0 and 0.2.0 as historical identities.

- index: 35,168 bytes,
  `ca6d684eb3100f4629c8ff4f65c7d0b4f6bcd49fc24768e798c9a71a6fbf3ce5`
- Core: 60,828 bytes,
  `1d41fd939d1cb2d65080346b2a3a251040a2739847cb9d0d0301c12c1655539b`
- Component: 62,594 bytes,
  `aa8adc704a5226914874b1ad49bf90835faa83098ff5c804c15efb1fd0e22fd0`

Two exact-tool builds are byte-identical. Wasmi 2.0 Core and generated Wasmtime
49 Component SDK execution pass. The package has zero Core imports and grants
no Host or version-selection authority. Its admission receipt is
[`admission/lib-search-v030-v017-admission.json`](../../admission/lib-search-v030-v017-admission.json).

## Admitted 0.2.0 v0.0.14 product candidate

Immutable `v0.0.13` and the prod pointer are unchanged. The admitted product at
`standard/wasmc-lib-search/0.2.0` indexes the thirteen prior package roots plus
itself: 14 packages / 122 package and API entries. Its exact future-product
catalog is `catalog/libs-v014.json`; it grants no Host or public-default authority.
The independent release closure at `catalog/lib-route-closure.json` proves that
all 14 v0.0.14 product package identities and all 108 exported API routes are
bound with `candidate_extras=0`. Future changes fail unless catalog, package
routes and API routes are regenerated together.

- index: 27,749 bytes,
  `613dacdcf58a225542aea99584a63fc282bcb08bfcc771f3f967482fadf31121`
- Core: 53,412 bytes,
  `f525deed55a3a942d63c6780b18ac7dc5e496dcf4ce47baaa2da0cbf1795afb1`
- Component: 55,178 bytes,
  `db0e7838424522e23a4f6d0e84759ca6fb631cb3ace516ac6ce514ec39bf831d`

Two current-toolchain builds are byte-identical; Node Core, Wasmtime 47
Component, and Wasmi 2.0 Core checks pass. The historical producer receipt has
different Core/Component bytes under an earlier unrecorded Rust codegen
environment. This is retained as an explicit reproducibility finding, not
silently relabelled as a deterministic reproduction. See
[`admission/lib-search-v020-v014-admission.json`](../../admission/lib-search-v020-v014-admission.json).

For the default Agent workflow and interpretation of package/API hits, start
with [Library-first discovery](../../skills/wasmc-lib-discovery/SKILL.md).
That strengthened Skill is a post-v0.0.10 guidance supplement; pin its full
tooling commit independently of the unchanged immutable product tag.

`wasmc:lib-search@0.1.0` is an ordinary hermetic WIT Lib. Its read-only index
is embedded in Wasm: five packages and89 package/API entries, including itself.
It snapshots admitted v0.0.9 packages plus its own source-bound WIT/path semantics.
It does not fetch, install, resolve a version or grant Host authority. Returned
paths are relative to the pinned release root, not arbitrary URLs.

The index is18213 bytes; Core view43871 bytes; Component view45637 bytes.
Both artifacts include the index. `index.lsi` is a comparison fixture only and
is not loaded by the Lib at runtime. Required imports=0. The portable Core view
uses Canonical value layout, not shared-memory/opaque-CoreLib zero-copy calls.
It does not make Std1.4.0 compatible with Wasmi or Node18.

After checking the pinned release's manifest and SHA256SUMS:

```sh
node examples/lib-search/run.mjs
node examples/lib-search/verify-api.mjs examples/lib-search/index-v018-v040.lsi standard/wasmc-lib-search/0.4.0 examples/lib-search/search-reference.wasmc current/wasmc.mjs
WASMC_SEARCH_LIB_ROOT="$PWD/standard/wasmc-lib-search/0.4.0" cargo test --locked --release --manifest-path examples/lib-search/rust/Cargo.toml
WASMC_SEARCH_LIB_ROOT="$PWD/standard/wasmc-lib-search/0.4.0" cargo run --locked --release --manifest-path examples/lib-search/rust/Cargo.toml
```

Bun runs the same `.mjs`; Deno uses `deno run --allow-read`. The typed JS view
is `client.mjs`; Rust uses the root's generated Component SDK. Both hide raw
pointers and post-return cleanup. Callers pin artifact/index digests and verify
the package before loading. There is no automatic ambient Host binding.

Search accepts UTF-8, <=256 query bytes, <=16 ASCII-whitespace-separated tokens,
and <=64 results/page. All tokens must match substrings; ASCII case folds only,
not Unicode case folding. Ordering is stable identity order, not ranking.
Empty queries list entries. Historical entries require `include_historical=true`.
Exact lookup is case-sensitive. Expected errors are `invalid-query`/`invalid-limit`.
Whitespace follows Rust `split_ascii_whitespace`: bytes09,0A,0C,0D,20; vertical
tab and nonbreaking space are token content. CLI paging uses `--offset N --limit N`.

Conformance compares every result field, ordering and pagination to an independent
WAsmC search algorithm compiled by the public compiler. Its test-only Host supplies
read-only corpus/query bytes, never matching logic. This proves search equivalence,
not a direct managed WAsmC caller profile for `result<list<hit>,E>`.
Actual Wasmi execution and generated Rust Component SDK invocation are separate
positive gates. GitHub Actions records each exact source; feature flags alone
are not an admission certificate. Runtime timings remain observational.

See [staged publication policy](../../docs/RELEASE_CHANNELS.md). dev/main are
prereleases; suffix-free prod is published only after the required qualification.
Current channel status is separate from the default prod `release.json`.
