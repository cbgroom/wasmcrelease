# Scoped owner lifetime

Fresh Host-issued 256-bit CSPRNG binding identity is checked before any local
resource lookup. Only `ScopedCompletionGuard.fresh()` uses binding-local raw
integers; those integers never escape its private state as an application API.
Its full opaque token always includes the binding identity. No new guest ABI.

This avoids exhausting the process-wide raw owner allocator merely because a
resident service repeatedly creates and retires fresh scoped guards. Explicit
identity constructors remain deterministic fixtures with the original global
allocator: repeated caller-selected identities do not gain unsafe local reuse.
Raw CompletionGuard keeps its original process owner and sequence exhaustion.
Do not use the internal local-guard factory as a raw guest ABI.

Each scoped guard still exhausts its local sequence rather than wrap. Create a
fresh binding for a new operation after retiring the old owner; never relabel
live pins. Supervisor ticket counters remain bounded at 32767 per identity.
On exhaustion, JS and Native supervisors issue a fresh identity only when all
owners, including quarantine, are gone. Otherwise admission fails before I/O.
Entropy failure never uses time, fixed seeds or old identity as a fallback.
An old epoch ticket is foreign to the new epoch and cannot drain or free it.

Mutable JS TCP supervision may now reuse an empty non-revoked binding with two
local IDs remaining. This is the same binding/counter, not a reset or reassigned
identity. Pending/quarantined/revoked guards are excluded. Exhausted empty scopes
are discarded and replaced by fresh CSPRNG scopes; see ../tcp/GUARD_POOL.md.
The explicit40000-fresh-binding regression below still creates independent
bindings; its supervised half also checks safe bounded pooling/epoch rotation.

## Verification

Run `node host/completion/lifetime-test.mjs` (also Bun or permission-free Deno).
It performs 40000 fresh guard lifecycles with stale-identity completion/release
denial and 40000 supervised settled reads with cleanup. At epoch exhaustion a
pinned quarantine prevents rotation even with free quota; verified retirement
permits fresh identity rotation, and the retired ticket remains invalid.
These reads use controlled fixtures, not network throughput measurements.

Rust `cargo test --release --locked --manifest-path host/completion/rust/Cargo.toml`
contains equivalent 40000 fresh-binding and registry retirement checks, plus
live-owner rotation denial. Cross-platform Actions must qualify changed source.
This bounded lifecycle regression is not an unbounded service guarantee,
cryptographic proof, Native RSS/leak qualification, never-settling containment
or full asynchronous backend SDK. Existing cancellation/late-completion and
real TCP retirement suites remain mandatory; do not replace them with this test.
