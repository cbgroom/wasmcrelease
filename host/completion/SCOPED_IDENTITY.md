# Startup binding identity — experimental Host boundary

The existing local i32 IDs remain registry internals. `ScopedCompletionGuard`
adds a validated binding-instance identity before lookup. JS uses canonical
`64-lowercase-hex:positive-i32` fixture tickets; Rust uses private typed fields
with explicit canonical wire conversion. Invalid/zero identities fail at
construction; malformed, foreign and out-of-range tickets reject without
changing resources, delivering data or unpinning an operation. Existing
quotas, cancellation/drain and revocation rules are delegated to the guard.

The identity must be issued by the trusted Host afresh for every binding-instance
namespace, including restarts and independently loaded registries. This prototype
accepts injected256-bit identifiers; it does not implement a Native entropy
provider or durable epoch issuer. Its test Host uses OS-backed `node:crypto`
randomBytes without a fixed fallback. Random collision resistance is not an
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
cargo build --release --locked --manifest-path host/completion/rust/Cargo.toml
node host/completion/scoped-test.mjs host/completion/rust/target/release/scoped-reference
```

Windows adds `.exe`. Each run starts four actual independent JS/Native processes,
verifies their local window/operation IDs collide after reset, then verifies
six old-ticket operations reject under a fresh binding identity. Independent
oracles check untouched live counts, own completed bytes and final cleanup.
Fourteen additional identity/ticket controls reject malformed/foreign values.
The two engines deliberately receive equal test identities only in that wire
conformance comparison, never to authorize transfer between production bindings.
The real file chain supplies separate fresh identities to its JS/Native bindings.
Bun and restricted Deno run the same process journey. Fixed nonzero identities
appear only in Rust unit tests, not the execution example. Fixture helpers are
trusted test tools, not production CLI/SDK entrypoints.

Still unclosed: production Host entropy/epoch issuance, negotiated physical
Core transport, typed guest async SDK, untrusted memory/thread races, browser/
mobile/Wasmtime qualification, performance qualification and immutable release.
Passing injected-identity tests does not close those delivery gates.
