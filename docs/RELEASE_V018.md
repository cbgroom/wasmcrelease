# WAsmC v0.0.18 portable protocol Lib release

v0.0.18 carries forward the v0.0.17 compiler, CoreLib, SDK, fixed thin Host
contract, Data Foundation packages, resident-memory package, and incubating
Client/Gateway bytes. It adds four import-free portable Lib identities without
extending the Host API:

- `wasmc:router-policy@0.0.1`: deterministic request routing and status policy;
- `wasmc:json@0.0.1`: JSON validation, compaction, and pointer selection;
- `wasmc:compression@0.0.1`: gzip compression and decompression;
- `wasmc:http1-server@0.0.1`: HTTP/1 request and response wire framing;
- `wasmc:lib-search@0.4.0`: the successor embedded snapshot that binds every
  v0.0.18 package and exported WIT API route.

The release catalog contains 22 exact package roots and 140 exported API
routes. Older LibSearch versions remain addressable as historical identities;
they are not overwritten. Resolution and installation require exact catalog,
WIT, and artifact digests.

All four portable Libs passed exact Node behavior suites, actual Wasmi 2.0 Core
execution, actual Wasmtime Component execution where applicable, zero-import
checks, and two independent byte-identical builds. Router qualification also
executes the Canonical ABI Component export, closing the earlier gap where only
the raw multi-value Core export was tested.

LibSearch 0.4.0 is produced from the caller-pinned 21-package input catalog,
adds its own source-bound WIT identity, and embeds 22 packages / 162 package and
API entries. Two independent builds using the exact build-tool commit and Rust
fingerprint are byte-identical. Exact Core execution passes Wasmi 2.0 and the
exact Component executes in Wasmtime 47.0.3. It has zero Core imports and grants
no Host, selection, admission, or lifecycle authority.

The fixed Host API remains unchanged. The Client/Gateway runtime stays an
incubating higher-layer product surface rather than a catalog Lib. Other
`libsrc` entries remain technical candidates until their qualification and
admission gates close; v0.0.18 does not relabel them as published.

Promotion follows dev -> main -> suffix-free prod with one unchanged v2 product
set. The final prod tree requires exact-candidate CI, two-model Pi pre-release
acceptance, immutable tags, and synchronized catalog/search/install routes.
