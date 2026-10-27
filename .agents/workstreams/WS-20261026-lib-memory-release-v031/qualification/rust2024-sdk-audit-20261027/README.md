# Rust Edition 2024 SDK audit

The inventory deduplicates actual installed candidate Roots by exact manifest
SHA-256: 43 Roots; 16 CoreCanonical SDKs declare edition 2021, one Core SDK
and 23 Component SDKs declare edition 2024. Remaining Roots have no such SDK
entry. These are local candidate installations, not an audit of every historical
release. Repeated installation paths are not counted twice.

`build-edition2024-sdk.mjs` derives a separate Rust 2024 source candidate from
a caller-selected independently pinned Root and verifies its SDK, Lib, Cargo
metadata and license inputs. All 16 old CoreCanonical bindings produced such
candidates. It performs a one-time syntax conversion while creating the new
candidate; the direct rustc request uses candidate SDK bytes unchanged. This is
not a fix to the authoritative WAsmC generator or an admitted release.

For Text 0.0.2, the actual running Rust 1.96.0 service compiled the unchanged
new candidate source plus `text-business.rs` with a cache miss. Its actual
Wasm e96c48d7830de20292db96c0faaf8b2bbf7a2938e613e5d3ef29158e285bd3d9
uses installed Text Core 520f2624d9aa602e9360ce06d78163a4baf5ede36c20b24ca29e374d3dff3b74;
Node and Deno each execute four inputs on one instance. JSON success, invalid
input fallback and recovery are independently recorded in the neighboring
`rust2024-json-sdk-candidate` folder. The other 14 candidates have not been
compiled or executed, and these results are simulated canonical-memory Hosts.

The relational candidate SDK is 484015 bytes before application source. The
running service returned HTTP 413 for that exact source because its current
request limit is 256 KiB. Headers and original response are preserved here.
The 16 candidates exist in separate local state, not installed or published
Roots. One-time derivation does not justify changing frozen SDKs, accepting
rehashed identities, or claiming broad 2024 parity.
