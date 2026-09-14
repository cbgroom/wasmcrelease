# Session-bound completion guard (experimental)

## Nonblocking Native read owner

The Native readiness profile also provides `ReadyUdpRead`, using the SAME
`ReadyRead` OS wait/cancellation kernel as TCP. Its preopened socket must already
be connected to an explicitly admitted peer; it adds no bind, DNS or ambient
network authority. Empty datagrams are successful messages, not stream EOF.
Read capacity is1..16bytes; an extra detection byte makes oversized datagrams
fail instead of silently truncating. That rejected message was consumed, so
error must not trigger replay. Cancellation wins over deadline and ready data;
the owner closes its descriptor before settlement. Embedding aliases remain
separately owned. This does not yet qualify typed guest UDP or mobile execution.

`rust/src/nonblocking_tcp.rs` owns one explicitly preopened TCP descriptor and
reads at most16bytes with one nonblocking syscall per poll. No DNS/listener,
thread, raw guest memory, new Host import or business dispatch is added.
Admission under `NativeOwnerSupervisor` bounds active plus quarantined owners.
Cancellation is a request, not close acknowledgement: retain quota and pins
until poll closes the owned descriptor. Cancel precedes deadline, both precede
reading even when bytes are ready. EOF is empty success; settlement is one-shot.
No alias closure or rollback of bytes already consumed by a completed read is
promised. Constructor rejects zero/oversized capacity and returns the descriptor.

The supervisor's cleanup-only `acknowledge_quarantine_close` hook preserves
existing backends by default. This owner cancels without reading, settles and
closes before acknowledgement. Premature completion stays quarantined until
this real cleanup, never force-unpins an open descriptor. Other backend failures
still retain their original quota and require their own close/settlement proof.

The embedding serializes polls and supplies monotonic time. The optional
`native-readiness` feature adds `ReadyTcpRead`: one OS queue, four event slots,
one owned read, one cancellation capability. `wait` uses OS readiness with the
remaining absolute deadline, not periodic sleep polling. Cross-thread cancel
wakes that same queue; completion/drop retires its wakeup so old cancellation
cannot act on another owner. Spurious/EINTR wakes recheck cancellation/deadline.
Default dependency graph stays unchanged. Native readiness uses Mio1.2.3 without
default features, only `os-poll` and `net` (not WASI, TLS or an engine dependency).

`wait` blocks the embedding's bounded I/O owner: it must not run on a guest
executor thread. It creates no worker threads. **A guest Future/executor adapter
and typed guest async SDK remain unimplemented.**
Socket reads still copy at most16bytes; this is not shared-memory/zero-copy.
Local and desktop Actions run25default tests (10new TCP/owner
controls), with exact source/input-digest receipts via:

```sh
node scripts/test-host-nonblocking-read.mjs
node scripts/test-host-nonblocking-read.mjs --readiness
```

The readiness profile runs45tests including six OS wakeup, three UDP owner and eleven shared/mixed
reactor controls. `read_reactor.rs` shares one OS queue, one wakeup and17event
slots across at most16preopened reads. Each read has its own scoped owner key,
cancellation and deadline. Completion closes before releasing supervisor pins;
`SocketReadReactor` uses that SAME generic driver/supervisor for mixed TCP and
connected-UDP reads. `ReadReactor` retains its TCP-only source-compatible view.
Both share finite quotas and cancellation namespaces; transport selection is
Host-only, not a guest opcode. Empty datagrams, stream EOF and explicit datagram
oversize results stay distinct. Mixed conformance runs16actual socket owners,
independent cancellation/deadline/oversize/success, quota rejection with returned
descriptor ownership, and real remaining-UDP-port reuse after owner teardown.
cancel requests retain quota until driven. A batch returns at most256owned bytes;
the embedding separately budgets queued/retained delivered results. Private
readiness IDs never reuse within an OS queue. At32767, a fully idle reactor
replaces the OS queue and cancellation namespace before admitting another read;
live/quarantined owners still reject rotation. Old cancellation capabilities
retain an empty retired namespace with no wakeup and cannot cancel a new read
even when its numeric ID matches. Boundary tests use real sockets and verify
descriptor ownership on rejected admission; they are not a40K OS throughput
soak. Completed/dropped
cancellation capabilities reject; fatal driver state denies further admission
and retains remaining owners/pins until explicit outer teardown. No thread per
read, periodically sleeping reactor, shared memory or guest-visible opcode.
CI qualifies Linux/macOS/Windows independently; local PASS is not their receipt.
No engine dependency, compiler source or immutable artifact is changed.

Follow-up [startup binding identity](SCOPED_IDENTITY.md) scopes references before
local lookup; actual independent-process tests cover reset-local-ID collisions.
The original unscoped guard below remains single-registry/process-local; use the
scoped driver plus trusted fresh identity issuance when crossing that boundary.

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
