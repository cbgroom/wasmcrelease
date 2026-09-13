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
terminal ticket exhaustion. Existing eight guard tests remain required.
An additional real loopback TCP test settles an actual read timeout, injects
one failed close acknowledgement, checks pinned quarantine, then obtains real
shutdown/descriptor retirement and peer EOF. Its read count remains one.
It is not a real failed OS-shutdown/crash-recovery or concurrent revocation
qualification; the injected failure is a trusted test seam.

Current underlying raw guard allocator has a terminal32767-owner process
budget; supervisor tickets also exhaust rather than wrap. This fail-closed
limit must be included in long-running performance/SDK design, not hidden by
microbenchmark numbers (which do not allocate these guards per call). Native
evented I/O, general never-settling containment, complete typed guest SDK,
unbounded service-lifetime qualification and immutable release remain unclosed.

Kernel CI's Mac ARM Bun synchronous-spawn empty-stdout failure is addressed
separately by event-driven `spawn`, waiting pipe drain and child close with
bounded timeout. No automatic retry of the guest/Native operation is introduced.
