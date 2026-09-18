# Startup binding identity — experimental Host boundary

The existing local i32 IDs remain registry internals. `ScopedCompletionGuard`
adds a validated binding-instance identity before lookup. JS uses canonical
`64-lowercase-hex:positive-i32` fixture tickets; Rust uses private typed fields
with explicit canonical wire conversion. Invalid/zero identities fail at
construction; malformed, foreign and out-of-range tickets reject without
changing resources, delivering data or unpinning an operation. Existing
quotas, cancellation/drain and revocation rules are delegated to the guard.

The identity must be issued by the trusted Host afresh for every binding-instance
namespace, including restarts and independently loaded registries.
`ScopedCompletionGuard.fresh()` now obtains256 bits from JS WebCrypto or Native
OS randomness (`getrandom=0.4.3`). Missing/failing entropy rejects with `-8`;
all-zero output rejects with `-5`. Partial failure and asynchronous JS entropy
adapters reject, without a time-based or fixed fallback. JS's injectable
`issueBindingIdentity(fill)` is a trusted synchronous adapter/test seam, not a
guest-selectable provider. Its success contract requires filling all32 bytes
with secure randomness; validation cannot certify an arbitrary injected CSPRNG.
There is no durable epoch issuer. Random collision resistance is not an
absolute uniqueness proof. Reusing the same identity after a local-counter reset
can still alias an old reference: constructors cannot detect reuse across
independent processes. Production must enforce fresh issuance, reject entropy
failure or use a durable monotonic namespace; never restore stale tickets or
use source/artifact hashes, timestamps alone, or guest-selected identity seeds.

Instance identity is not a secret, signature or authorization capability.
Permission still comes from the owning explicitly bound registry and grants.
These are private Host/reference transport tickets, not Agent source API or
physical Core/WIT ABI. No new syscall or mandatory system import is introduced.
The real file/App/Lib chain now passes scoped tickets only inside its reviewed
Host driver and keeps generated App/Lib bytes unchanged.

```
cargo build --release --locked --manifest-path host/runtime/completion/rust/Cargo.toml
node host/runtime/completion/scoped-test.mjs host/runtime/completion/rust/target/release/scoped-reference
```

Windows adds `.exe`. Each run starts eight actual independent JS/Native processes,
verifies their local window/operation IDs collide after reset, then verifies
six old-ticket operations reject under a fresh binding identity. Independent
oracles check untouched live counts, own completed bytes and final cleanup.
Fourteen additional identity/ticket controls reject malformed/foreign values.
The two engines deliberately receive equal test identities only in that wire
conformance comparison, never to authorize transfer between production bindings.
Four additional processes issue their own identities with WebCrypto/OS randomness
and repeat old-ticket rejection after a real process reset. Five JS entropy
controls and two additional Rust issuer tests check failures and actual issuance.
The real file chain issues fresh identities inside each JS/Native Host, without
passing Native a parent-process seed.
Bun and restricted Deno run the same process journey. Fixed nonzero identities
appear only in Rust unit tests, not the execution example. Fixture helpers are
trusted test tools, not production CLI/SDK entrypoints.

Still unclosed: durable epoch issuance, negotiated physical
Core transport, typed guest async SDK, untrusted memory/thread races, browser/
mobile/Wasmtime qualification, performance qualification and immutable release.
Local issuer/process tests do not close those delivery gates or qualify every
platform entropy backend. Actions run these same tests on all six desktop targets;
cross-platform acceptance requires the exact new candidate's completed results.
