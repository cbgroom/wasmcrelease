# Release Lib search

## Unreleased 0.2.0 v0.0.13-complete candidate

Immutable `v0.0.13` is unchanged. The candidate at
`candidates/wasmc-lib-search/0.2.0` indexes all thirteen released package roots
plus its own candidate identity: 14 packages / 122 package and API entries.
Its exact input is `catalog/libs-v013.json`; it neither chooses a version nor
grants Host authority.

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
[`admission/lib-search-v020-v013-candidate.json`](../../admission/lib-search-v020-v013-candidate.json).

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
node examples/lib-search/verify-api.mjs examples/lib-search/index-v013-v020.lsi candidates/wasmc-lib-search/0.2.0 examples/lib-search/search-reference.wasmc current/wasmc.mjs
WASMC_SEARCH_LIB_ROOT="$PWD/standard/wasmc-lib-search/0.1.0" cargo test --locked --release --manifest-path examples/lib-search/rust/Cargo.toml
WASMC_SEARCH_LIB_ROOT="$PWD/standard/wasmc-lib-search/0.1.0" cargo run --locked --release --manifest-path examples/lib-search/rust/Cargo.toml
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
