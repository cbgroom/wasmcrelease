# CoreLib-owned bytes + actual file I/O conformance

This is reviewed private physical-ABI integration reference code, **not an
application SDK or a general grant to untrusted modules**. Only the two curated
callers in this directory may be linked here. Their `heap` import whitelist
checks names/kinds, not full hostile-module safety or digest authorization.
Agent applications continue to use typed semantic APIs/generated bindings;
they must not discover, construct or pass these private raw references.

The Host preopens the input read-only and output writable. Guest paths are not
accepted. A successful settled read and acknowledged file close precede creating
CoreLib-owned bytes. CoreLib stores/allocates the bytes; the WAsmC/Rust App reads
them through the same three scalar/handle imports and performs the sum. The
Host writes the resulting eight-byte little-endian integer and syncs the file.
The Host does not implement the algorithm. No new Host operation or language
memory model is introduced, and no compiler/provider artifact is rebuilt.

Provider: `standard/corelib/4.8.0/corelib.wasm`, SHA-256
`f54a892aff9068e5c79464029423a2e8f753ddb44010af9ac34a5c9efce2069c`.
Opaque i64 references/type handles may be negative; zero is failure. Value
envelopes use high 32 bits for status, low 32 bits for the payload. Do not
confuse handle sign with success/error or expose this carrier as semantic API.
Provider identity is fixed by digest, not inferred from version ordering.

Host packing captures at most16 indexed bytes once before calling the Core
builder, so validation cannot disagree with a second getter read. Invalid/sparse
input makes zero Core builder-allocation calls. `snapshot-test.mjs` exercises
seven real-provider controls on Node/Bun/restricted Deno, including the original
valid7 then256 getter that silently produced sum0. `allocationCalls` is a trusted
conformance counter, not a guest syscall or public application API. CoreLib
remains the only owner/allocator of the resulting object graph.

## Reproduce locally

From the repository root (installed Rust wasm32 target required):

```sh
mkdir -p target/corelib-io
rustc --edition=2024 --crate-type=cdylib --target=wasm32-unknown-unknown -O -D warnings -C panic=abort host/core/io/private-abi-guest.rs -o target/corelib-io/rust-guest.wasm
node host/core/io/test.mjs
bun host/core/io/test.mjs
deno run --allow-read=current,host/core/io,standard/corelib,target/corelib-io --allow-write=target/corelib-io host/core/io/test.mjs
```

Rust compilation uses local rustc CLI, not Cargo or a remote service. The WAsmC
caller is compiled with the frozen current facade, and full-module validation
is mandatory before instantiation. Temporary test files are isolated beneath
`target/corelib-io`, removed in finally; no repository-wide cleanup occurs.

Each engine checks eight successful real input/output cases across two callers
and ten controls: cancelled read settles without allocating/calling the App,
oversize allocation rejects, foreign Provider caller rejects before dispatch,
trap releases the read-only Core object and poisons the App, poisoned App does
not replay. Every dropped reference is rejected by CoreLib and the wrapper.
Pre-existing output is not touched by these non-output controls. Failed close,
async Core borrow retention and hostile code are outside this narrow fixture;
the existing supervised failed-stop path remains required for uncertain I/O.

## Scope and next acceptance

Local Node/Bun/restricted Deno plus both Native engines pass eight actual-file
cases per JS/Native pair. Native also proves trap cleanup/stale rejection and
poisoned dispatch denial; it does not claim the JS asynchronous read-cancel
control is implemented by its synchronous file fixture. Native input File drops
after the scoped read; this is not a general failed-close supervisor SDK.

Build/run Native parity (the optional feature also retains Wasmi):

```sh
cargo build --release --locked --features wasmtime-engine --manifest-path host/tests/e2e/rust/Cargo.toml
node host/core/io/test.mjs host/tests/e2e/rust/target/release/corelib-io-reference
node host/core/io/test.mjs host/tests/e2e/rust/target/release/corelib-io-reference --wasmtime
```

For Deno Native pairs add only `--allow-env=NODE_V8_COVERAGE` and
`--allow-run=host/tests/e2e/rust/target/release/corelib-io-reference` to the above
restricted command. Windows uses the `.exe` suffix. The harness awaits Native
pipe drain/close with a 30s test-process watchdog; it never replays business I/O.

Next: exact-source cross-platform CI, then main acceptance. This is a packing/copy profile,
not shared linear memory, zero-copy windows, portable Std qualification, or a
release. Std1.4.0 still requires function references/tail calls; using its exact
CoreLib Provider alone does not repair that unrelated compatibility gap.

Known frozen compiler defect: comparison of a derived i64 expression against an
untyped zero can emit an invalid i32 comparison. The reviewed caller uses an
explicitly typed i64 intermediate and typed zero instead. Explicit `as s32` /
`as i64` conversions are not admitted here; use the existing canonical source
surface, not a hidden compiler capability. This workaround is not a compiler
fix; preserve the defect as a producer-side follow-up before claiming closure.

## Bounded resource lifetime / cost probe

After building the reviewed callers/reference above:

```sh
node host/core/io/lifetime-test.mjs host/tests/e2e/rust/target/release/corelib-io-reference
node host/core/io/lifetime-test.mjs host/tests/e2e/rust/target/release/corelib-io-reference --wasmtime
```

Each JS/Native pair executes100000 owned3-byte allocations/App/drop cycles for
each consumer, checksum14342320. Samples every20000 cycles must reach a plateau;
the very first reference must still reject after100000 subsequent allocations.
Native verifies100000 allocations and100000 successful drops. JS tracks no live
owner records. Both report actual CoreLib linear-memory size, not process RSS.

Local Node/Bun/restricted Deno with both Native engines passed; six samples all
1310720bytes(1.25MiB). Observed whole-cycle costs were roughly0.4-0.7us JS,
1.8-2.4us Wasmi and0.4-0.5us Wasmtime; preparation is separately reported.
Timing includes allocation, input packing, App read/sum, drop, counters/oracles
and Host overhead. No speed threshold/engine minimum or peak guarantee is
claimed. Units are `steady_ms * 1e6 / calls`; informational timings are not
portable performance assertions. The prior8-byte/result file benchmark is a
different workload. This is not full Std73API execution, RSS leak proof,
network/file throughput or infinite-lifetime qualification.

Without a Native argument the lifetime test needs read permission only. For
Deno use `--allow-read=standard/corelib,target/corelib-io`; Native pairs additionally
need only `--allow-env=NODE_V8_COVERAGE` and the exact `--allow-run` path. No file
writes, network or ambient credentials are used by this memory-only probe.
