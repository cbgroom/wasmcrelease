# v0.0.10 staged release

First development identity: `v0.0.10-dev.1`. This is a GitHub prerelease;
the default prod remains immutable `v0.0.9`. All0.0.x retain `stable=false`.
Main acceptance and suffix-free prod require successful full source-free CI
and LibSearch equivalence on the retained exact candidate. See
[promotion policy](RELEASE_CHANNELS.md) and [product inventory](../channels/candidates/0.0.10.json).

## New ordinary LibSearch

`wasmc:lib-search@0.1.0` embeds a fixed release index in its Wasm. There is no
runtime external index/config input. Five packages and89 entries include its
own semantic API, without an artifact-hash self-reference. Index18,213bytes;
Core43,871bytes; Component45,637bytes; zero Core imports. Relative paths keep
the index compact. Private Lib authority is recorded separately from the reused
compiler authority in [admission](../admission/lib-search-v010.json).

Use a pinned tag/archive, verify package integrity, then run:

```sh
node scripts/wasmc-lib.mjs search "base64 decode"
node scripts/wasmc-lib.mjs search "counter" --historical --limit 8
node examples/lib-search/run.mjs
```

Search now returns v2 typed `hits` (package and API entries), not old v1
package-only output. Exact resolve/install continue using the separately pinned
four-package v0.0.9 catalog: search does not select a version, install a package,
or grant capabilities. Consume this new package from its pinned
`standard/wasmc-lib-search/0.1.0` root and generated Rust SDK; see
[consumer commands and limits](../examples/lib-search/README.md).

## Qualification and boundaries

Local Node18/26, Bun and Deno each pass576 Rust-produced Lib / independent
WAsmC / independent JS comparison cases and11,000 resident calls. Tests cover
all fields, lookup, ordering, pagination, error bounds, ASCII-only folding,
non-ASCII whitespace and post-return cleanup. Actual Wasmi Core and generated
Rust/Wasmtime Component SDK tests are also required in the new Linux/macOS
Actions matrix. [Live equivalence results](https://github.com/cbgroom/wasmcrelease/actions/workflows/lib-search.yml)
and [full consumer results](https://github.com/cbgroom/wasmcrelease/actions/workflows/source-free-consumer.yml)
are source-bound qualifications, not a claim that pending jobs passed.

This Lib uses the portable Canonical ABI value view, including private normal
allocations. It is not shared memory, zero-copy, a CoreLib managed-handle fast
profile, or a direct managed WAsmC `list<hit>` caller qualification. Its portable
Core passes Node18 and Wasmi without function references/tail calls; this does
not fix the existing Std1.4.0 feature requirements. Compiler and existing Lib
bytes are reused unchanged. No third-party Lib build/publish or Ultra/device
platform closure is claimed. No performance threshold or stable1.x promise is
introduced.
