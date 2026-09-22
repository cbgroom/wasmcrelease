# Release Lib search

## Unreleased 0.2.0 remediation candidate

Immutable `v0.0.12` is not rewritten. This branch adds
`wasmc:lib-search@0.2.0` as a **future-release candidate** built with the
official `wasmc lib build` pipeline from the published v0.0.12 Lib inventory.
Its embedded index contains 13 packages including itself and 117 entries:

- index: 26,206 bytes,
  `7f33c20e46499dd016f8656b075c78366a683686c070794d20dec152fbb8cbe5`
- Core artifact: 51,868 bytes,
  `3dc83d83709527c126620635ea0e8cd0a51b2fbfeef544818d8526406fe62a99`
- Component: 53,634 bytes,
  `0be046c52c1ae731d22f1e96e788b693d0e264dce9e78a9893260030618a71d0`

Package rows accept explicit package ids and release-approved intent keywords;
API rows remain API/signature-only so package intent does not flood precise API
searches. The original business feedback query set is a required regression.
Independent WAsmC-reference qualification currently covers 604 comparison
cases plus 11,000 resident calls with stable memory pages.
Machine-readable candidate evidence is
[`admission/lib-search-v020-candidate.json`](../../admission/lib-search-v020-candidate.json).

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
node examples/lib-search/verify-api.mjs examples/lib-search/index-v012-v020.lsi candidates/wasmc-lib-search/0.2.0 examples/lib-search/search-reference.wasmc current/wasmc.mjs
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
