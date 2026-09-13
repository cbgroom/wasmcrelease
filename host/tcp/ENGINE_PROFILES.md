# Resident Core engine profiles

This is public mutable Host/reference glue, not a replacement for the frozen
Runtime SDK or a new immutable release. Default builds use Wasmi 2.0.0 only.
The optional `wasmtime-engine` feature adds exact Wasmtime 47.0.4 (runtime and
Cranelift, no WASI). It is intentionally absent from the default dependency
graph. Mobile/no-JIT qualification is not implied by desktop Wasmi tests.

The mutable default reference consumes binary Core Wasm only, not WAT text.
Wasmi text parsing is omitted; stable/std/validate/memory64/auto-dispatch remain
explicitly enabled. Binary module validation and per-call fuel are not disabled.
The optional Wasmtime graph may include its own text tooling; this restriction
describes the default Wasmi reference, not every dependency or the frozen SDK.

Both profiles instantiate the same digest-bound WAsmC App and reviewed
owned-algorithms Core Lib once, allocate one private Lib slab, reset fuel per
call and enforce 16-byte inputs. Computation stays in the Lib. Only trusted
fixture arguments select `--wasmtime`; there is no new guest syscall, automatic
promotion, replay, WASI import or network authority. A guest trap poisons its
resident App and the next call is rejected without another Lib invocation.

Local commands (repository root):

```sh
cargo build --release --locked --manifest-path host/lib-e2e/rust/Cargo.toml --features wasmtime-engine
node host/tcp/server-test.mjs host/lib-e2e/rust/target/release/tcp-server-reference host/lib-e2e/rust/target/release/resident-app-reference
node host/tcp/server-test.mjs host/lib-e2e/rust/target/release/tcp-server-reference host/lib-e2e/rust/target/release/resident-app-reference --wasmtime
```

Each run compares JS with its selected Native engine: 19 real connections
(17 valid, two malformed), 1000 additional resident calls, input rejection,
post-Lib guest trap, poisoned-call/no-replay checks and eight listener controls.
The receipt identifies `native_engine` and both artifact digests. Node, Bun
and restricted Deno use this same harness. Actions qualifies both profiles on
six desktop platforms and 14 JS/Native pairs per profile. Increasing the job
budget to 30 minutes accommodates optional Cranelift compilation; queued CI
does not block local iteration. PASS must be read at the exact pushed source.

These fixtures do not establish engine promotion, arbitrary typed guest async
transport, hard wall-clock preemption, blocked-write cancellation, TLS, browser
or mobile support. See [listener ownership](LISTENER.md),
[read stop](READ_STOP.md) and [write outcomes](WRITE_OUTCOMES.md).
