# Session-bound completion guard (experimental)

This public Host-side guard adds no external primitive. Within one registry
namespace, session-qualified opaque IDs are never reused; exhaustion rejects.
Four windows/four operation records (including terminal records), sixteen bytes
per window and finite session/sequence counters bound the fixture. JS private
fields and Rust private state keep mutation inside the registry API.

Submit clears and pins its window. A pending operation cannot be released, its
window cannot be read/released/re-submitted. Cancel changes delivery state but
**retains the pin until backend completion acknowledges it has stopped using
the window**. Late completion drains the pin without copying cancelled bytes.
Duplicate/stale/foreign completions reject. Revoke prevents new grants/readout
and cancels pending delivery; completion/drain/release still work. Backend error
becomes a terminal failed record with no data. Terminal records require release.
Malformed completion does not drain a live operation. Repeated poll is passive.

Caller cancellation is not proof of no external effects: writes may already
have happened. This guard only controls delivery/lifetime. Backend cancellation,
deadlines and revocation enforcement need separate implementation. A backend
that never acknowledges termination retains a bounded pin; the Host must safely
terminate/quarantine it rather than reuse its memory. No forced timeout release.

`test.mjs` compares independent JS/Rust result and live-count traces with explicit
oracles, including quota, foreign IDs, malformed/duplicate completion, cancel,
revoke, failure and cleanup. A deferred JS Promise exercises cancel-before-late
completion; Native traces are deterministic completion injection, not OS thread
race proof. Existing `host/lib-e2e` uses the guard around its real file read then
runs identical WAsmC App/Lib bytes and verifies real output bytes.

```
cargo build --release --locked --manifest-path host/completion/rust/Cargo.toml
node host/completion/test.mjs host/completion/rust/target/release/wasmc-completion-guard
```

Windows adds `.exe`. Bun and restricted Deno run the same test. JSON stdin is
trusted test trace transport, not a production Host RPC or guest ABI. State
transition calls are serialized (JS event loop / exclusive Rust `&mut`); shared
thread transitions and races must be mediated by the owner, not assumed safe.
IDs are not secrets/authorization by guessing resistance. Access requires the
owning registry and explicitly bound capability; fixed fixtures expose IDs only
to conformance tests. These handles must never cross registry loader namespaces,
processes or restart boundaries. Independent processes restart counters; a
production boot/session identity and negotiated typed Core SDK remain unclosed.
No browser/mobile/Wasmtime, untrusted memory, power-loss or immutable SDK release
qualification is claimed. The original memory simulator retains its narrower
cancel-before-effect semantics; it is not substituted for this real-I/O guard.

`read-window.mjs` consumes a trusted preopened input. It awaits the issued read
even when cancellation request fails, converts read failure into a drained
terminal record, releases window/record and closes the input. Cleanup failure
does not mask the original read failure. There is no timeout force-release.
The guarded chain includes actual write-only descriptor read failures with
unchanged output and zero live guard resources. JS file operations are serialized
and reject concurrent read/write/sync/release while busy, matching exclusive
Native access. `fault-test.mjs` adds ten controls including descriptor lifetime,
read/close failure precedence, old completion after window reuse, independent
input/output snapshots and 32767 allocations through exact sequence exhaustion.
Four Rust unit tests include those state invariants and 512 unique sessions
allocated across eight threads (allocator uniqueness, not shared-state races).
Sparse byte arrays, oversized cancelled completions and non-i32 status values
reject rather than silently filling zeros or truncating lanes. The trusted
Native JSON test launcher also rejects out-of-range IDs/status without casting
them to another live token. Current parity trace contains76transitions.
