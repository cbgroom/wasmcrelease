# Rust 2024 JSON Core SDK candidate

This is a separate, unreleased Rust glue SDK candidate for the exact installed
`wasmc-json` 0.2.1 candidate Root. The Root, its original SDK and Core Wasm are
not modified. It is derived from that Root's verified generated SDK: 28 extern
blocks and 26 export attributes are updated to Rust 2024 spelling. It is not a
new output of the WAsmC producer and is not an admitted Lib Root or a formal
release. The SDK does not itself load the Lib.

`build-sdk.mjs <installed-root> <new-output-directory>` verifies the exact
Root, SDK and Core artifact identities, preserves the Root license, and builds
this candidate reproducibly. The source and metadata under `candidate/` are the
result. Compilation of the proof request used `candidate/src/lib.rs` bytes
unchanged, followed by `business.rs`; no syntax adaptation occurs on that
request or in the compiler service. The proof used direct `rustc` compilation,
not Cargo. The small request comment distinguishes its cache key; it does not
affect compiled behavior.

The local container's `/translate` returned a real cache miss and success;
`response-headers.txt` records the artifact digest. `result-node.json` and
`result-deno.json` report four inputs each and the same installed Lib Core
identity. For each call the guest asserts the exact JSON edit and an invalid
input fallback; subsequent calls prove same-instance recovery. The JavaScript
canonical-memory adapter and local installed candidate are not production
Host or published-install evidence.

Producer-level general Rust 2024 generation, multi-Lib composition, release
admission and installed public distribution remain open. Do not overwrite the
original Root manifest or advertise this candidate as producer-generated.

`prepare-consumer.mjs <candidate-dir> <installed-root> <business.rs>
<independently-pinned-sdk-sha256> <new-output.rs>` composes the already-built
candidate SDK and business source without modifying either. It verifies the
SDK, license, installed Root and Lib pins before creating the new source file;
the caller must choose the exact SDK hash independently. The compiler service
remains responsible for compiling that source. The assembler's actual service
cache-miss response and Node/Deno executions are recorded in the
`assembler-*` files. Negative controls reject a wrong selected SDK hash and a
modified installed Lib before writing output. This is still a single-SDK
prototype, not installed compiler-service integration.
