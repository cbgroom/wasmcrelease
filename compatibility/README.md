# v0.0.9 Core compatibility and independent reproduction

This is a supplemental, digest-bound contract for the existing immutable
v0.0.9 bytes, not a changed release tag or a new standard-Lib variant.
Follow-up scripts and this contract are on public `main`; consumers using them
must pin its exact commit and verify that checkout's SHA256SUMS. A checkout of
the original v0.0.9 tag does not contain this later preflight tooling.

## Confirmed diagnosis

Independent tests with official SHA-verified Darwin arm64 Node18.19.1 reproduce
the standard Core artifact rejection: `invalid value type 0x64 @+265`.
The same engine validates the current compiler, automatic4.3 provider and
standard4.8 provider. The standard Core artifact requires **both** typed
function references and tail calls, not just ordinary reference-types.

Actual types38/39 contain `(ref 1)` and `(ref 2)` function parameters;
helpers161/162 use `call_ref`. With only wasm2, wasm-tools1.255.0 rejects at
0x106 for function references; adding function references still rejects at
0x7dce for tail calls. `wasm2,function-references,tail-call` validates. Compiler
and both providers validate under wasm2 alone. The validation profiles are
sufficient tested profiles, not proof that every constituent feature is needed.
No GC-managed App/List/String memory model is inferred from these reference types.

Primary specifications: [typed function references](https://github.com/WebAssembly/spec/blob/main/proposals/function-references/Overview.md)
and [tail calls](https://github.com/WebAssembly/tail-call/blob/main/proposals/tail-call/Overview.md).

## Consumer preflight

```bash
node scripts/check-core-compatibility.mjs
node scripts/test-core-compatibility.mjs
node scripts/validate-current.mjs --compile-only
bun scripts/check-core-compatibility.mjs
deno run --allow-read scripts/check-core-compatibility.mjs
```

Select individual artifact IDs with arguments, for example
`node scripts/check-core-compatibility.mjs compiler standard-provider standard`.
Read `core-artifacts-v009.json` for exact identities and profiles. Preflight
checks byte length and digest first, then minimal feature probes, then complete
artifact validation. It performs no instantiation or authority grant. The
standard Host reference now runs it before module construction. Missing features
produce JSON code `engine.feature_unsupported` with an ordered list, instead
of a V8 byte-offset surprise. Identity drift and complete-module rejection have
different codes. Run this once at artifact loading, not inside resident App calls.
It is a public consumer reference, not automatic admission for arbitrary third-party
Libs, the entire compiler facade or the native Runtime SDK.

Node18.19.1 fails both extra probes and rejects standard; Node22.0.0 and26.5.1,
Bun1.3.14 and Deno2.9.4 pass the probes, full artifacts and standard caller
oracle in this independent matrix. These are **exact tested versions**, not
`Node >=22` or an inferred minimum engine guarantee. Platforms and flags are
part of the evidence; no experimental flags are silently enabled.

## Separate JavaScript Host requirement

Node18.19.1 lacks a default global `crypto`. The original full
validate-current.mjs run reaches `current/index.mjs`'s managed instantiateLib
verification and rejects with `ReferenceError: crypto is not defined`.
This is distinct from standard's unsupported Wasm types. A passing compiler
validation or expression compilation is not a passing full managed journey.
The supplemental preflight does not polyfill WebCrypto, change the frozen facade
or claim Node18 managed-source support. Compiler-only tests and full paths are
recorded separately. A future portable variant or facade fix requires its own
source-authority change, admission and new publication, not retagging v0.0.9.

## Evidence and limits

See [independent evidence](../admission/core-compatibility-v009.json). Official
Linux CI [run34729449573](https://github.com/cbgroom/wasmcrelease/actions/runs/34729449573)
passed the three pinned Node compatibility jobs, three JS deployment jobs and
integrity job. At this documentation checkpoint its full Rust rebuild remained
in progress; consult the linked live result rather than treating it as a full-run PASS.
Official
runtime archive SHA checks prove equality with their published checksums, not
an independent publisher-signature verification. Minimal feature probes execute
`run()=7` where supported. Negative tests cover tampering before engine work,
unknown IDs/features, invalid bytes, tail-call-only rejection and full-module
rejection even when tiny probes pass.

The external tpc02 report is useful attributed input; its original scripts/logs
were unavailable. This matrix is a new independent reproduction, not a recreation
of all114 tests, claimed1M timings, ratings or common-task coverage percentages.
No generic JSON library, shared-everything/window/ring, public third-party build,
catalog/resolver, automatic profile promotion or production rollout is claimed.

Next separate source-authority workstreams: Lib catalog/search/resolve/install,
then public third-party Lib build. Keep ordinary algorithms in std/CoreLib.
