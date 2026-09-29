# WAsmC v0.0.19 ordinary-source u64 release

v0.0.19 publishes new source-free compiler bytes from exact private authority
`566eff42d0f4e4680c5ddd60c6584a9d8ff8e9f4` and carries forward the v0.0.18
Lib catalog unchanged. Product capability and lifecycle stage remain separate;
read `release.json` and the channel manifests for the published stage.

## Added capability

- ordinary-source `u64` locals, parameters, results and nested source payloads;
- explicit synchronous `u64` Host-import lanes;
- full `0..=18446744073709551615` literals and wrapping arithmetic;
- unsigned comparison, division, remainder and right shift;
- exact WIT `u64` identity over the Core `i64` physical lane.

The release does not infer adjacent capabilities. Async ordinary source remains
unsupported, Map remains resident/local through a matching Lib rather than a
direct public WIT value, and `char` remains unimplemented.

## Compiler identity

- bytes: `1399677`
- SHA-256: `4e0b9779df3bf7b627d7d9fbfc43cfffd67bb053f87c69a9f832c5690b6888a2`
- imports: `0`
- producer tree: `1625bbf407a46308296f3f18b9947cc0ad5c4b6c`

Two independent clean-target release builds produced byte-identical compiler
artifacts. The candidate compiled and executed unsigned maximum, comparison and
right-shift cases through the thin Node Host, `wasm-tools`, Wasmtime and the
embedded current facade. Exact evidence is in
`admission/compiler-v019-u64-admission.json`.

## Agent flywheel closure

The compact release-orientation route now requires the final answer to name
`agent-release-orientation.json` literally. This targets the retained v0.0.18
post-release GLM finding without weakening the oracle or rewriting v0.0.18.

## Carried-forward surfaces

The exact v0.0.18 catalog remains selection authority for all 22 packages and
140 exported API routes, including LibSearch 0.4 and the four portable protocol
Libs. The Client/Gateway surface remains incubating and does not become a formal
Lib or production fleet service in this release.
