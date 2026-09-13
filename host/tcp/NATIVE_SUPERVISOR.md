# Native owner registry reference

The mutable completion crate now exports `NativeOwnerSupervisor<E>` and a
trusted `QuarantineEndpoint` trait. These Rust types are internal Host glue,
not Rust ABI across a Lib boundary or a new guest syscall. Scope-qualified
opaque tickets, active+quarantine quota1..16, and endpoint ownership on admission
failure match the JS supervisor policy. Default Native endpoint values are
owned, not shared/cloned capabilities. Exclusive mutable borrows serialize
endpoint access/retirement; they do not prove arbitrary Arc/registry races.

The trusted backend borrows its admitted endpoint, executes bounded I/O and
calls `finish_settled` or `quarantine_settled` **after** issued I/O settles.
The registry itself does not issue or preempt asynchronous I/O. Close callbacks
must acknowledge descriptor closure and settled/joined I/O; a fabricated Ok is
not evidence. Quarantined endpoints cannot be borrowed for new work. Retirement
waits close/endpoint acknowledgement before complete/drain/free. Failed close
or retirement keeps pins and quota. Normal completion validates byte capacity,
closes endpoint and returns copied data or preserves its explicit read error.

```sh
cargo test --release --locked --manifest-path host/completion/rust/Cargo.toml
cargo test --release --locked --manifest-path host/lib-e2e/rust/Cargo.toml
```

Four new registry unit tests cover invalid quota/capacity, quota ownership
return, foreign/stale tickets, normal completion, failed close/retirement and
live-owner epoch rotation denial. Existing eight guard tests remain required.
An additional real loopback TCP test settles an actual read timeout, injects
one failed close acknowledgement, checks pinned quarantine, then obtains real
shutdown/descriptor retirement and peer EOF. Its read count remains one.
It is not a real failed OS-shutdown/crash-recovery or concurrent revocation
qualification; the injected failure is a trusted test seam.

Raw and injected-identity guards retain their terminal32767-owner process
budget. Fresh CSPRNG scoped guards no longer consume that global budget;
their integers remain private to the unique binding. Supervisor epochs rotate
only after all active/quarantined owners retire, otherwise fail closed. Local
40000 guard and registry cycles include old-ticket denial and live quarantine
rotation denial. See ../completion/LIFETIME.md. This is not RSS/leak proof. Native
evented I/O, general never-settling containment, complete typed guest SDK,
unbounded service-lifetime qualification and immutable release remain unclosed.

Kernel CI's Mac ARM Bun synchronous-spawn empty-stdout failure is addressed
separately by event-driven `spawn`, waiting pipe drain and child close with
bounded timeout. No automatic retry of the guest/Native operation is introduced.

Subsequent failure hardening: malformed settled completions (oversize bytes or
positive error status) now quarantine/revoke rather than leave an active owner
which could accept a corrected completion. Retain the quota/pins until explicit
verified close/retirement; do not issue business I/O or publish replacement
bytes. The trusted backend still must prove I/O has settled before this call.

`failure_observation(ticket)` exposes Host-only `primary`, optional `retirement`
failure and `invalid_completion`, never read bytes. A valid read error plus
failed close preserves both errors; primary0 plus close failure means valid
completion delivery was suppressed, not successful external delivery. Foreign
or retired tickets reject. Explicit cancellation quarantine may have no failure
observation, which is not an error-free delivery receipt.

The current guard/owner suite has15tests. Additional cases cover malformed
completion quarantine, failed read+close observation, forbidden correction/new
endpoint borrow, failed retirement retention and foreign/stale observation
denial. Existing exact acceptance records with12/14tests remain historical
truth, not qualifications for this changed source. Native async/race/OS fault
coverage is unchanged; full current-candidate cross-platform CI remains required.
