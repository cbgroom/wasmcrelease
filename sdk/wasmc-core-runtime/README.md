# wasmc-core-runtime

> **Agent entry:** read [SKILL.md](SKILL.md) before generating integration code. Verify the pinned checkout/release status first.

Public release source authority: private wasmc commit
`bddf8a371698ac7f1ced87b02952df5be5359dad`. The immutable outer release tag
and this directory's bytes are the distributable identity; the private commit
is provenance, not a runtime network dependency.

`wasmc-core-runtime` is the compiler-independent Core Wasm execution SDK from
wasmc. It provides immediate Wasmi completion, bounded asynchronous Wasmtime
preparation, explicit promotion and rollback, fresh invocation state, and
selected-backend failures without replay.

The SDK owns engine mechanics only. Package, capability, application, routing,
persistence, and deployment authority remain with the embedding Host.

## Recommended execution route

The intended runtime policy is **Wasmi now, Wasmtime/AOT when ready** rather
than a synchronous either/or engine choice.

1. Admit one exact Core Wasm + Host policy identity with Wasmi.
2. Serve the current fresh invocation immediately through the Wasmi completion
   path when no admitted faster cache entry exists.
3. Coalesce a bounded background Wasmtime compile through
   `request_promotion`. Queue/full/compiling states never stall the Wasmi route.
4. Until compilation and Host admission are complete, later fresh invocations
   keep using Wasmi.
5. After an exact candidate is published, future invocations snapshot the
   Wasmtime route. The invocation that was already executing is not migrated.
6. Rollback atomically returns future calls to Wasmi; a selected-backend
   failure is never replayed on the other backend.

`PromotionRuntime` supplies the in-memory prepared-module/catalog layer. The
outer Host/runtime may additionally consult the target-local AOT cache produced
by `wasmc-native-compiler`. That persistent cache is keyed by exact Wasm bytes,
Wasmtime version, target, CPU features and AOT profile. A safe Store/Instance
pool can be layered above prepared modules as another hot cache, but pooling is
not part of the guest ABI and must preserve request-local Host state and cleanup
semantics.

From a checked-out release root:

```toml
wasmc-core-runtime = { path = "sdk/wasmc-core-runtime" }
```

From the public Git repository, pin the immutable release tag or full commit:

```toml
# v0.0.12 example; for later releases use the exact immutable tag/full commit whose bytes you reviewed.
wasmc-core-runtime = { git = "https://github.com/cbgroom/wasmcrelease.git", tag = "v0.0.12" }
```

`CoreRuntimeSdk::inspect_core` validates bytes through the Wasmi completion
engine and returns an engine-neutral description of exact imports, exports,
external kinds, and Core function signatures. Hosts use those physical facts
for their own WIT, capability, entrypoint, and package admission without paying
a synchronous Wasmtime compilation. Inspection creates no Store, Instance,
binding, invocation, effect, capability, or publication decision.

The canonical Host integration surface is the WIT/Core flat-scalar lane. Its
exact descriptors and typed request-local sessions carry i32, i64, f32, and
f64 values plus checked linear-memory access without exposing either engine's
Caller, Store, Instance, or Memory types. Floating values cross the boundary as
exact bit patterns.

Hosts can bind one complete `CoreRuntimeLimitProfile` to an SDK instance. The
profile carries separate engine-native fuel budgets plus common wall-clock,
linear-memory, table, and concurrent-Store limits. It is part of the exact
artifact identity, and rejected resource use has the stable
`CoreRuntimeInvocationErrorCode::ResourceLimit` class on either engine.

Wall-clock interruption covers guest execution. Host callbacks remain
cooperative and must enforce their own I/O deadlines. Every invocation still
uses a fresh Store, and a selected-backend failure is never replayed.

`invoke_scalar_with_session_state` returns the consumed typed Host state after
both successful and failed calls, so response bodies, measurements, resources,
and cleanup records remain request-local without a shared mutex. The controlled
variant accepts a cloneable `CoreRuntimeCancellation`; bounded profiles observe
it at Wasmi fuel quanta and Wasmtime epoch ticks. Cancellation has its own
stable error class, returns Host state, and never retries on another backend.
