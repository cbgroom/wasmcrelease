# Published Lib + real Host composition

Run `cargo build --release --locked --manifest-path host/lib-e2e/rust/Cargo.toml`
then `node host/lib-e2e/test.mjs host/lib-e2e/rust/target/release/wasmc-lib-host-e2e`
(Windows adds `.exe`). Bun runs the same harness.

The Host reads a preopened real input file into a bounded 16-byte window. A
single compiler-produced WAsmC App calls the existing digest-bound, zero-import
`wasmc-owned-algorithms@0.1.0` Core Lib `sum-s32` through a fixture transport
adapter. Byte-to-s32 marshalling, not summation, belongs to that adapter. After
successful guest completion, the Host writes an eight-byte little-endian i64
result and explicitly synchronizes the preopened output file. Independent
oracles verify disk bytes, empty/full windows, readonly denial and no flush on
guest trap. JS WebAssembly and Wasmi2 run identical App and Lib bytes.

This is Host-scheduled read/compute/write, not an implementation of guest async
continuations or public typed Core resource SDK. JSON is not used as a Host ABI.
Private pointers stay inside reviewed fixture marshalling; users do not gain
guest-selected filesystem paths. Transfer/range budgets are fixture limits.
The JS slab is freed and Native Lib Store is dropped after the test invocation;
resident allocation stability is not qualified here. Native fuel is bounded;
this trusted fixture is not a general untrusted execution SDK and lacks general
memory/revocation/late-completion limits. Successful file sync does not prove
directory/crash/power-loss durability, and a failed write is not rolled back.

Actions qualify six desktop Node/Wasmi pairs and four Unix Bun/Deno pairs. This
does not close browser, mobile, Wasmtime, network/TLS/server or immutable SDK
release gates. Follow-up main results are not retroactively part of old tags.
