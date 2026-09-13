# Resident App/Lib microbenchmark

The public harness measures the same frozen WAsmC App and owned-algorithms
Lib on JS, Wasmi and optional Wasmtime. It does not measure network service,
database, durability or end-to-end request TPS. No speed threshold is enforced
on shared Actions runners. Correctness, artifact identity and invocation counts
are asserted; performance values are observations, not product guarantees.

```sh
cargo build --release --locked --manifest-path host/lib-e2e/rust/Cargo.toml --features wasmtime-engine
node host/tcp/server-test.mjs host/lib-e2e/rust/target/release/tcp-server-reference host/lib-e2e/rust/target/release/resident-app-reference
node host/tcp/benchmark.mjs host/lib-e2e/rust/target/release/resident-benchmark target/host-tcp-app/guest.wasm --wasmtime
```

The server regression first compiles the digest-bound guest using the public
compiler. Benchmark initializes one App/Lib pair, warms 1000 calls, then samples
seven batches of 100000 calls. Each call marshals two bytes into the private
Lib slab and runs App -> Host binding -> Lib sum. Input varies through 200
values; each sample checksum must equal 10650000 and total Lib calls 701000.
Native resets fuel each call, JS has no engine fuel; these remain distinct
execution limits. Default invocation without `--wasmtime` compares JS/Wasmi.

Receipt includes initialization milliseconds (module compilation/instantiation
and allocation, not OS process spawn), all seven samples, median ns/call,
artifact digests, platform/architecture and JS runtime. JS RSS is sampled after
each batch; it is not Native RSS or a leak proof. Exact source is the workflow
SHA in the containing CI log/summary. For local evidence, record `git rev-parse
HEAD`, dirty state, hardware/runtime versions and the command beside receipt.
Do not attach a clean-source identity to an uncommitted local measurement.

Actions runs the same checksum/count harness on six Native desktop platforms
and 14 JS/Native pairs, after both engine correctness matrices. Cross-platform
timing cannot be compared without environment context. Mobile/browser support,
full Host performance qualification and immutable release remain separate gates.
