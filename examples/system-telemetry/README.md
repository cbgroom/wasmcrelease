# Telemetry consumer qualification

Candidate tooling, not a prod installation command. The Rust consumer uses
generated Wasmtime bindings from the public WIT and a supplied Component only;
it never links telemetry implementation source. It exercises construction,
drop, cache freshness, counter deltas, atomic failures, missing input, backwards
time and double drop. Its first local probe reused exact warm Wasmtime49
dependencies with matching panic=abort; this is not a clean Cargo multi-OS build.

Copy the exact candidate lib.wit to consumer/wit/world.wit and verify its digest.
Build using `cargo build --release --locked --manifest-path consumer/Cargo.toml`.
Run `telemetry-consumer /absolute/path/to/component.wasm`.

The standard wit-component encoder constructs the Component from the resource
guest. Raw Core imports include Canonical resource new/drop intrinsics, not
ambient Host permissions. Do not instantiate raw Core bytes without a correct
resource manager or teach private pointers/handles as an Agent API.

Formal release still requires WAsmC consumption, source-bound cross-platform
qualification, strict package/discovery gates and immutable promotion.
# Public Host SDK integration candidate

Run from a pinned candidate checkout:

```bash
bash scripts/test-telemetry-host.sh
```

This copies only public `wasmc-host`, Core Runtime SDK and file/memory driver
glue, the consumer source, and the exact WIT to an isolated consumer workspace.
The monitor implementation and build caches are excluded. The same staged
Component bytes are used; no monitor or compiler is rebuilt. The consumer is
built with a locked Cargo graph and Wasmtime 47.0.4, matching the published Host
SDK's runtime version. The earlier standalone Component caller uses Wasmtime49
and remains a distinct test.

All OSes run nine generic resource controls and one SDK-to-Component fixture
test with deliberate short reads and transactional parse failure. Linux also
grants precisely four read-only proc resources, obtains complete bounded
snapshots through `WasmcHost::read`, executes 128 monitor frames, and releases
all four grants. Input acquisition is shell-free. Snapshot timestamps are
caller supplied, and the four external resources are not an atomic OS snapshot.
The live loop bounds Component fuel and linear memory; no real-time scheduling
or zero-allocation claim is made.

This closes the tested native embedding path, not a generated WAsmC guest
owning sampler/window resources. The staged package still lacks an admitted
WAsmC receiver/value binding contract. Do not substitute raw numeric handles,
handwritten application plans, or a telemetry-specific Host callback. No
Windows/macOS system acquisition, Browser, Wasmi execution, or formal release
is implied by the portable fixture tests.

Package verification now pins the package manifest and products to the
independent producer receipt selected by the checkout. Twelve real mutated
copies are rejected, including self-rehashed replacement, path escape,
unexpected files, missing files and linked references. This is offline
integrity verification, not signing or production admission.
