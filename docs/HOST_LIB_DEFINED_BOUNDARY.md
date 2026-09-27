# Lib-defined Host boundary workstream

Status: **asynchronous readiness Linux aarch64 locally qualified; x86_64 refresh pending / not admitted / not released**.

This workstream replaces domain growth in the Rust Host with a fixed,
domain-neutral execution boundary. It does not modify the immutable v0.0.15
product identity. Existing file, memory and network drivers remain retained
qualification and migration evidence; they are not the authority for the next
Host architecture.

## Product rule

The Host must not gain a new Rust/JavaScript API, driver family or platform
matrix row merely because a new system domain is required. File systems,
processes, sockets, services, clocks, entropy, cameras, accelerators and future
domains are Lib semantics.

The fixed Host owns only mechanisms:

- Core/Component execution;
- opaque external targets and resources;
- owned bounded windows;
- operation submission and completion;
- wait, cancellation, late-completion drain and release;
- execution of a Lib-supplied native boundary descriptor.

The Host does not interpret the domain meaning of a descriptor, operation
payload or result. A full-host controller is trusted with the host as a whole;
this profile does not insert per-domain grant or allowlist APIs between a Lib
and the fixed boundary.

## Target architecture

```text
WFC / application
        |
        v
portable system Libs
  VFS / process / network / services / devices / scheduler
        |
        v
platform system Libs
  POSIX / Darwin / Win32 / platform ABI descriptors
        |
        v
fixed Lib-defined native boundary
  target / resource / window / operation / completion
        |
        v
host OS, native library, system service or device endpoint
```

Adding a new domain normally adds or updates Lib packages only. If adding the
domain requires a Rust Host edit, the boundary is incomplete unless the change
is proven to be a new irreducible mechanism shared by multiple domains.

## Lib-defined native boundary descriptor

A descriptor is data owned and versioned by a Lib. It identifies a native
target and describes the physical call shape required to exchange bounded
windows and scalar metadata with it. The exact descriptor language remains an
open design item; it must eventually cover:

- target lookup without a domain-specific Host method;
- calling convention and scalar/layout information;
- input, output and in/out windows;
- opaque native-handle lifetime;
- synchronous and asynchronous completion;
- callback or event conversion into Completion records;
- platform-specific implementation selection;
- deterministic rejection of unsupported physical shapes.

The descriptor is not a JSON replacement for WIT. WIT remains the public typed
semantic contract of the Lib. The descriptor is the lower physical binding
owned by that same exact Lib package.

## Linux convergence through its native abstractions

Linux is the first native convergence target. The fixed Rust executor does not
contain `/dev` names, filesystem methods, process methods or device-specific
branches. It verifies the exact Lib adapter identity, loads it, and invokes one
bounded byte ABI. The Linux platform Lib owns a generic VFS/file-descriptor
adapter and supplies endpoint paths as Lib data.

The one-shot adapter was exercised on local Linux aarch64 and independent CI
Linux x86_64. Its persistent-resource successor is currently exercised on local
Linux aarch64 against `/dev/zero`,
`/dev/null`, `/proc/self/stat` and `/sys/devices/system/cpu/online`. This proves
that devfs, procfs and sysfs can converge through Linux's existing abstraction
without one Rust Host API per device. Sockets and ioctl-based device protocols
remain future Lib-level adapter profiles; a device-specific ABI or state model
belongs to a higher Lib, not to the fixed executor.

Exact shared-object SHA-256 verification is package integrity, not a capability
grant or device allowlist. The full-host profile intentionally introduces no
per-domain permission API.

The persistent executor loads and verifies the adapter once, reuses one bounded
output window, and exchanges framed operations/completions. The Lib—not the
executor—owns generation-checked FD tokens, read/write, `poll`, raw `ioctl` and
cleanup on unload. Local aarch64 qualification performs a real `TIOCGPTN` ioctl
on `/dev/ptmx`, rejects a stale token after close, and measures pipelined
`/dev/zero` reads plus `/dev/null` writes. The retained threshold is 25 MiB/s in
each direction and at least 5x lower per-operation cost than cold process/load/
open execution; exact observations belong in the versioned receipt rather than
being advertised as a portable hardware guarantee.

The Lib now also owns generation-checked `mmap` regions. Qualification maps a
real `/dev/zero` endpoint, writes and reads a bounded region, executes `msync`,
rejects an out-of-bounds request, unmaps it, and rejects the stale mapping token.
This proves device mapping without adding `mmap` or device semantics to the
fixed Rust executor. It is not yet end-to-end zero-copy: the current byte ABI
still copies between the native mapping and the executor window. A direct
guest/shared-window profile remains a separate gate.

The next Lib-owned mechanism is a generation-checked `epoll` event set. The
local Linux aarch64 qualification opens a real PTY master through `/dev/ptmx`,
unlocks and opens its `/dev/pts/N` slave, registers the master, writes through
the slave, waits for and reads the readiness event, removes the registration,
and rejects a stale event-set token after close. The fixed Rust executor remains
byte-identical and contains no `epoll` or PTY semantics. This is evidence for
Lib-defined readiness aggregation only: the call currently waits synchronously
inside the persistent executor session and does not yet prove asynchronous
completion delivery, cancellation, late-completion draining or `io_uring`.

The Lib now also owns `pipe2` endpoints and Linux `splice`. The local aarch64
qualification transfers 16 MiB through the real kernel path
`/dev/zero -> pipe -> /dev/null`, keeps payload bytes out of the fixed Rust
executor window, and rejects a stale pipe token after close. The observed local
rate is recorded only in the exact receipt. This is kernel endpoint-to-endpoint
zero-copy evidence; it does not close the separate guest/shared-window
zero-copy gate because commands and completions still cross the byte ABI.

The next Lib-owned resource is an asynchronous readiness operation. It duplicates
the endpoint FD so backend work cannot outlive its native ownership, runs the
wait outside the executor call, and exposes pending, ready, cancelled,
timed-out and failed terminal states. Local qualification proves real PTY
readiness, deterministic cancellation and timeout, pending-release rejection,
terminal re-cancel rejection, cancellation-priority over late readiness,
64 concurrent operations, stale-token rejection and safe cancellation after
the original endpoint token is closed. The current one-worker-per-operation
implementation is a lifecycle baseline, not a throughput design. It does not
yet prove the Host Completion bridge, late-delivery drain or `io_uring`.

## Library OS consequence

The intended result is a Library OS profile assembled above the fixed Host:

```text
fixed executor + fixed native boundary
  + platform system Libs
  + portable OS Libs
  + application Libs
  + WFC controller
```

VFS, process models, networking, protocols, service management, device models,
state reconciliation and higher policy can evolve independently of the Host
binary and can use the ordinary Lib lifecycle: build, qualify, admit, catalog,
discover, install and release.

## Migration

1. Freeze the domain-neutral boundary model and its negative checks.
2. Define the first descriptor profile without file/process/network names.
3. Re-express one retained real-file chain as platform and portable Libs while
   keeping the Host binary unchanged.
4. Repeat with process and network behavior without adding Host APIs.
5. Compose those Libs into the first Library OS profile and execute a WFC
   controller against a real host.
6. Only after behavior, lifecycle and cross-engine qualification, admit the
   boundary and Lib packages into a future immutable product.

The first decisive acceptance test is three-domain growth with one unchanged
Host binary: file behavior, process behavior and network behavior must be added
or replaced solely through exact Lib packages.

## First executable proof

The local Node reference now passes that first structural/runtime proof with one
fixed executor at SHA-256
`e133672195a9641e8c813f6b07e040c5817249a055f44ebeadd9c29404cf03ef`:

- `wasmc-system-file-prototype` performs a real local file read;
- `wasmc-system-process-prototype` executes a real child process;
- `wasmc-system-network-prototype` performs a real loopback exchange.

Each Lib owns its WIT, descriptor and digest-bound adapter. The Host executor
contains no domain API and is byte-identical for all three. The test additionally
proves pinned-window release rejection, completion claim-once, adapter digest
rejection and zero remaining resources/operations/windows.

The mapped-window, epoll-readiness and kernel-splice predecessors are qualified
on local Linux aarch64 and independent GitHub Ubuntu x86_64. The asynchronous
readiness lifecycle successor is locally qualified on aarch64; its independent
x86_64 refresh remains pending. WIT is parsed by pinned `wasm-tools` before
native qualification. Wasm lowering, the Host Completion bridge and
late-delivery drain, `io_uring`, direct guest-window zero-copy, non-Linux
evidence, admission, catalog publication and immutable release remain pending.

The exact local receipt is
`admission/host-lib-defined-boundary-v1/local-qualification.json`, bound to
implementation commit `46f88f0fb1040b43cda1a9dbafeefe420b73647a`.

The exact Linux aarch64 receipt is
`admission/host-lib-defined-boundary-v1/linux-aarch64-qualification.json`, bound
to implementation commit `2b2e51cd30dac57a341ac3c709eab070bb534549`.

The exact Linux x86_64 receipt is
`admission/host-lib-defined-boundary-v1/linux-x86_64-qualification.json`, bound
to successful workflow run `36298739381` at commit
`66af77c3996f2d8fba5d87667870c79ce3fedc6e`.

The persistent-session Linux aarch64 receipt is
`admission/host-lib-defined-boundary-v1/linux-aarch64-persistent-v2.json`, bound
to implementation commit `a9226aae8c15285765c942f1eed02ba2b38c5363`.

The persistent-session Linux x86_64 receipt is
`admission/host-lib-defined-boundary-v1/linux-x86_64-persistent-v2.json`, bound
to successful workflow run `36299428864` at commit
`cd6fddb9f17ab62a651164472e6ae6f238b30cca`.

The mapped-device Linux aarch64 receipt is
`admission/host-lib-defined-boundary-v1/linux-aarch64-mapped-v3.json`, bound to
implementation commit `a0f382ab609e9df2fdda5124f4dd5e832c2fee3d`.

The mapped-device Linux x86_64 receipt is
`admission/host-lib-defined-boundary-v1/linux-x86_64-mapped-v3.json`, bound to
successful workflow run `36300032417` at commit
`12f0ca7bd49f2317fc28f2d0eb6e566b04fdc4eb`.

The epoll-readiness Linux aarch64 receipt is
`admission/host-lib-defined-boundary-v1/linux-aarch64-epoll-v4.json`, bound to
implementation commit `d83fc6a823f4dfa6be9e013a4938394eb5ce055d`.

The epoll-readiness Linux x86_64 receipt is
`admission/host-lib-defined-boundary-v1/linux-x86_64-epoll-v4.json`, bound to
successful workflow run `36300559026` at commit
`0bcc62a417a973fd2c7dc751632c2a25741a0635`.

The kernel-splice Linux aarch64 receipt is
`admission/host-lib-defined-boundary-v1/linux-aarch64-splice-v5.json`, bound to
implementation commit `5bd57e308a7d727ff4bab3238b566473d1688efe`.

The kernel-splice Linux x86_64 receipt is
`admission/host-lib-defined-boundary-v1/linux-x86_64-splice-v5.json`, bound to
successful workflow run `36301089197` at commit
`fbae9337787c7c7c3c0c9e51bd1ed22cdb5235d5`.

The asynchronous-readiness Linux aarch64 receipt is
`admission/host-lib-defined-boundary-v1/linux-aarch64-async-readiness-v6.json`,
bound to implementation commit
`4669122072beba1f4c7901e92d1b39629dc4fd75`.
