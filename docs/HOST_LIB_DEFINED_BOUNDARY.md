# Lib-defined Host boundary workstream

Status: **ioctl call-shape and vectored-write Linux aarch64/x86_64 qualified / not admitted / not released**.

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

The Linux Lib now separates the three physical ioctl argument shapes instead of
pretending every request takes a pointer buffer: no argument, scalar value and
pointer buffer. Local Linux aarch64 qualification executes real `FIOCLEX`,
`TCSBRK`, `TIOCGPTN` and `TIOCSPTLCK` calls on a PTY. It also sends 64 payload
segments in one `writev`, verifies their concatenated bytes through a real pipe,
rejects a stale endpoint token and retains the existing performance floor. The
fixed Rust executor remains byte-identical and contains none of these Linux
operations or device semantics.

Those generic mechanisms are now consumed by a separate
`wasmc-system-linux-uinput` Lib without changing the fixed Host source or API.
Retained Linux aarch64 and x86_64 qualifications create a real kernel virtual
keyboard, observe key-down, key-up and synchronization records through its real
evdev node, reject stale generation-checked keyboard tokens, and exercise 200
batches containing 3,200 logical key events with one kernel write per batch.
The measured rates are same-machine diagnostics, not portable throughput
promises. UHID create/input/output/report lifecycle, UHID vectored reads and USB
Gadget UDC binding remain explicit device-backed gates.

The next platform Lib is `wasmc-system-linux-socket`. It owns Linux IPv4 TCP
socket creation, bind/listen, connect/accept, stream transfer, readiness poll,
endpoint identity and half-close while reusing the byte-identical fixed native
executor. Retained Linux aarch64 and x86_64 qualifications prove a real
loopback transport, 64 concurrent retained connections, stale-token and
wrong-resource-kind rejection, and a bounded throughput floor. This is the
first physical transport slice for migrating the retained HTTPS workload;
The retained HTTPS workload now has a Linux migration candidate that switches
the same TLS/HTTP/Wasm graph to this exact socket adapter. The production
default remains unchanged until both required Linux architectures and the
independent release qualification are retained.

The legacy HTTPS qualification has no hard RPS floor. Its hard gates are
artifact identity, request/recovery behavior, forced partial writes and exact
operation/wait/claim plus byte/lifecycle accounting; its GitHub-hosted timing
is explicitly observational (`performance_regression_gate=false`). Its Rust
qualification Host contains performance-sensitive transport policy: the
polling owner, `mio` readiness owners/shared reactors, shard selection, optional
CPU affinity, Host windows and operation scheduling.

The Lib-owned socket qualification currently has a 25 MiB/s smoke floor. That
floor rejects a catastrophically broken physical adapter; it is not an HTTPS
SLA and cannot be compared directly with HTTPS RPS. Before the HTTPS migration
gate can close, the old and new transports must run the same TLS/HTTP/Wasm
request graph in a paired same-runner A/B, preserve all hard lifecycle gates,
and explicitly adopt a performance-parity policy. The migration profile in
`scripts/host-https-ab.mjs` is the hard pre-release gate: semantic and lifecycle
parity plus paired RPS p50 of at least `0.90` against the Rust-owned transport.
It dynamically loads the exact adapter in the HTTPS process through the generic
descriptor boundary, because the separately qualified operation-session
process is a lifecycle/isolation mechanism and its pipe IPC is not the intended
data plane. The raw transport A/B in
`scripts/host-socket-migration-ab.mjs` isolates physical-boundary cost with the
same one-connection, 64 KiB bidirectional echo workload, but deliberately
records `https_transport_migrated=false`.

The first Linux aarch64 same-runner migration qualification preserved the
256-request forced-partial-write corpus (`5159` issue/wait/claim operations,
`4620` partial writes, checksum `93106`) and measured paired RPS p50 `2.044x`
the old transport. Independent Linux x86_64 CI run `36316303486` retained the
same lifecycle counts and checksum, measured old/new RPS p50
`2335.639/3510.297`, and passed the `0.90` policy at `1.573x`. These are
qualification results, not admission or a production-default switch;
descriptor review, Wasm lowering and admission remain open.

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

## Android target profile

Android now has a target-specific fixed Host at
`host/runtime/lib-boundary/native-android` and a Library OS profile at
`host/platform/android/agent-computer-profile.json`. Target-specific does not
mean domain-specific: the executable verifies and invokes exact Lib-owned
descriptors but contains no display, UI, input, Android command or service API.

Four candidate bindings expose platform-neutral APIs:

- `wasmc:system-display@0.0.1` through `wasmc-system-android-display`;
- `wasmc:system-ui@0.0.1` through `wasmc-system-android-ui`;
- `wasmc:system-input@0.0.1` through `wasmc-system-android-input`.
- `wasmc:system-virtual-input@0.0.1` through
  `wasmc-system-android-uinput`.

The binding profile is no longer maintained as two positional API/provider
arrays. `agent-computer-request.json` names the exact candidate set and target;
`host/platform/profile-resolver.mjs` reads Lib-owned `system_binding` metadata
and emits explicit API-to-provider rows in the v2 profile. Selection matches
OS, architecture, device/simulator environment, embedding, boundary and
lifecycle. Missing or ambiguous providers fail closed, provider names carry no
selection authority, and an ambiguity requires an exact provider pin. The
resolver is deployment control plane and adds no domain API to the fixed Host.

Android qualification resolves the complete four-API agent-computer profile on
an ARM64 emulator. Android physical device, macOS, Windows and iOS device still
reject until their own exact qualified Lib providers are supplied. The separate
iOS Simulator supervisor profile resolves only `wasmc:system-display@0.0.1`;
requests for semantic UI, input or virtual input still reject. Future platforms
reuse the same WIT API identities where semantics match, while provider and
profile versions remain independent.

The Android 16/API 36 ARM64 emulator qualification runs all three adapters
through one Host identity. It captures a 1080×2400 frame, queries the semantic
Settings hierarchy, waits until the search editor is authoritatively focused,
types `display`, verifies the exact text and search result, opens Display size,
and confirms both foreground/UI semantics and a changed frame. It also rejects
a malformed input operation and a descriptor with the wrong adapter digest.

The focus gate is intentional: a preliminary direct command issued before the
live input connection was ready produced only a suffix. Command completion is
therefore never treated as proof of UI effect; query-before-control and
UI/frame postconditions are part of the profile contract.

The v2 qualification adds direct `/dev/uinput` without changing the Host
source or binary. A persistent Host session creates a virtual keyboard, accepts
a malformed operation as an ordinary negative status and continues, emits a
14-state key batch as 28 kernel events, destroys the device, rejects the stale
generation, and successfully recreates it. The semantic UI receives the exact
text `display`. Separate negative controls reject input and output limit
violations, a missing adapter export, and an adapter outside the descriptor's
exact sibling directory.

The v3 qualification extends that same platform-neutral virtual-input Lib with
a direct touchscreen resource. One persistent session now executes the full
control chain—UInput touch of the semantically queried search box, UInput
keyboard entry of `display`, and UInput touch of the semantically queried
Display size result—then confirms the foreground Activity, semantic result and
changed frame. Generation checks cover both keyboard and touchscreen.

Session EOF is also a lifecycle boundary: the adapter destructor removes an
undestroyed virtual device. Two concurrent Host sessions prove process-local
resource isolation by closing one device while the other remains active. The
authoritative removal check uses Android EventHub's active-device section;
`Input Reader State` may retain an older asynchronous snapshot after kernel
removal and is not used as resource authority.

This closes the emulator-level query/control/confirmation and direct-UInput
mechanism slices, not the whole product lifecycle. The adapters are still
native descriptor candidates rather than WFC-lowered Wasm components.
Physical-device qualification, descriptor review, admission, catalog
publication and release remain pending.

The exact local Android receipt is
`admission/host-lib-defined-boundary-v1/android-arm64-agent-computer-v1.json`,
bound to implementation commit
`3613413debd75fa2a19e785a4240908ba2ff6566`.

The direct-UInput and deeper Host-mechanism successor receipt is
`admission/host-lib-defined-boundary-v1/android-arm64-agent-computer-v2.json`,
bound to implementation commit
`aae36dfc69f0eb05a359737e30000cf793de002e`. Its single observed batch latency
is diagnostic only and is explicitly not a performance gate.

The direct-touchscreen and session-lifecycle successor receipt is
`admission/host-lib-defined-boundary-v1/android-arm64-agent-computer-v3.json`.
Its observed keyboard batch latency is also diagnostic only. The fixed Android
Host digest remains unchanged; no touchscreen or resource API was added to it.

The exact-target profile-resolution successor receipt is
`admission/host-lib-defined-boundary-v1/android-arm64-agent-computer-v4.json`,
bound to implementation commit `82d266a9bae16f7eff21e9d73ca5a338807f04d8`.
It retains the complete Android control/lifecycle chain while proving exact
profile regeneration, target and lifecycle rejection, ambiguity rejection and
exact-pin recovery. It also closes a Lib-owned UI snapshot publication race
with a bounded wait. Resolver, readiness and provider metadata changes require
zero fixed-Host source or binary changes.

## iOS Simulator observation profile

The first iOS slice uses Xcode 27.0 with an iOS 26.5 ARM64 iPhone 17 Pro
Simulator. A fixed macOS supervisor Host verifies and loads the exact
`wasmc-system-ios-simulator-display` descriptor and adapter. The adapter owns
the platform-specific `simctl io screenshot` operation; the Host contains no
display or iOS command API. A real 1206×2622 Settings frame and an independent
appearance-change frame postcondition qualify the display binding.

The target tuple explicitly uses `embedding=supervisor`. This evidence does not
qualify execution inside an iOS application or on a physical iPhone. Public
`simctl` provides no Android-UInput-equivalent system input injection or full
semantic UI tree. The full four-API agent-computer request therefore fails
closed instead of substituting development automation for an iOS-native
capability. Embedded Host, UI query, input, virtual input, physical-device,
Wasm lowering, admission and release remain pending.

## iOS native app-internal profile

The next iOS slice embeds a second fixed, domain-neutral Host in a normal iOS
application rather than driving the Simulator from macOS. The app profile
registers twelve statically linked Lib providers without adding domain methods to
the Host: sandbox storage, secure state, TCP/UDP loopback, UIKit semantic UI,
window capture, Metal acceleration, SQLite, cryptography, offline audio,
embedded WebKit and protected-capability observation. Exact WIT package
identities remain in the profile; Apple frameworks occur only in provider
implementations.

On the iOS 26.5 ARM64 iPhone 17 Pro Simulator, one run proves an atomic
Application Support round trip plus `fsync`, secure random, `UserDefaults`, a
signed-app Keychain add/read/delete round trip, wall and monotonic clocks, real
POSIX TCP and UDP loopback, foreground semantic UI query and action with a
state postcondition, a 1206×2622 outer screenshot plus in-app PNG capture, and
a completed Metal command-buffer copy, a WAL/transaction/prepared-statement
SQLite round trip, AES-GCM and P-256 round trips, non-silent offline audio
rendering, and local DOM/JavaScript execution. The Host reports eleven exact
provider identities plus a centralized authorization provider and still has
zero domain APIs. Its source SHA-256 remains
`f0d465ba7f23698d6365453b02fad2f4a0803171f970631751fc90a00a86d96f`,
identical to the six-provider qualification.

Camera, microphone, motion, location, notification and background-refresh
states are observed without requesting permission. Simulator absence is a
target observation, not a Host failure or a claim of physical-device support.

Authorization discovery, planning and attempt history are also Lib semantics.
The authorization provider identifies thirteen permission-free App capabilities
and preflights ten protected categories with zero prompts. It requests a needed
`not-determined` category whenever no request for it is currently in flight;
prior unsuccessful attempts remain history and do not permanently suppress a
later request. A denied iOS category routes to a reofferable Settings recovery
path because iOS itself will not show that system prompt again. Restricted or
unavailable capabilities fail closed. A caller may present one rationale screen for a batch,
but iOS does not permit unrelated system permission prompts to be combined.
The qualification tests the planner state machine and persistent ledger without
causing a system prompt; real prompt/result callbacks remain a physical-device
qualification.

The Keychain check intentionally uses Xcode's Simulator ad-hoc app signing.
Disabling code signing produced a real missing-application-identity failure and
is not an acceptable qualification configuration. The probe also runs only
after `applicationDidBecomeActive`, so an inactive launch callback cannot be
misreported as foreground capability.

This is a native capability laboratory, not an admitted Lib release. Its Swift
providers are statically linked and directly invoked; WIT-to-Wasm lowering and
dynamic Component loading are still open. Physical-device execution and
protected or lifecycle-sensitive camera, microphone capture, location, motion,
notifications and background work also remain explicit gates.

The retained eleven-provider successor receipt is
`admission/host-lib-defined-boundary-v1/ios-arm64-app-capability-v2.json`, bound
to implementation commit `f3bfb7d54ada5735c72774f5293ad29fdeab50a7`.
It preserves the exact fixed Host digest from the six-provider predecessor;
only the Lib provider set and profile grew.

The prompt-minimizing authorization successor receipt is
`admission/host-lib-defined-boundary-v1/ios-arm64-app-capability-v3.json`, bound
to implementation commit `d509336ee2d2bc87d9ea0509ff202541648c750d`.
It adds the unadmitted `wasmc-app-authorization-policy@0.0.1-dev.1` public-source
candidate and a matching iOS status adapter while retaining the same fixed Host
digest. No system permission prompt was produced by qualification.

The corrected repeatable-demand successor is
`wasmc-app-authorization-policy@0.0.1-dev.2`. It removes the v3 one-attempt
suppression rule: persistent attempt history is diagnostic evidence only,
in-flight requests are deduplicated, and a later demand can request again when
the observed state remains `not-determined`. The retained v4 receipt is
`admission/host-lib-defined-boundary-v1/ios-arm64-app-capability-v4.json`, bound
to implementation commit `dc0d0e36e2772aeec585829c5bd5da9f16c9eb66`.

The next simulator slice separates authorization policy from protected-domain
use. Simulator privacy control grants Contacts to the exact App identity; the
authorization Lib observes `authorized`, then the independent
`wasmc-system-ios-app-contacts@0.0.1-dev.1` Lib creates, fetches and deletes a
temporary contact and confirms cleanup. A separate reset run proves that the
Contacts Lib does not attempt access in `not-determined`. The fixed Host remains
byte-identical and contains no Contacts API. The retained v5 receipt is
`admission/host-lib-defined-boundary-v1/ios-arm64-app-capability-v5.json`, bound
to implementation commit `607a55fc3288cf81ebbdc65962f243eaaae6dfc0`.

The successor iOS prompt-flow qualification uses fresh exact App identities and
XCUITest to drive the real localized Contacts system UI. The allow path crosses
Continue and Share All, records one attempt, observes `authorized`, and performs
the Contacts roundtrip. The deny path records one attempt, observes `denied`,
plans `open-settings`, and proves the Contacts Lib does not access data. It also
delays capability execution until the App has returned to active after the
authorization callback. The fixed Host is unchanged. The retained v6 receipt is
`admission/host-lib-defined-boundary-v1/ios-arm64-app-capability-v6.json`, bound
to implementation commit `9b87e28d250e5a51dce72a3f486d0502c6ddf278`.

The separate iOS surface-control laboratory qualifies the minimal multimodal
control shape without injecting physical input. Five stable UIKit surfaces
continue independent Agent progress; one requests human intervention, expands
without replacing its View instance, accepts real XCUITest user input, contracts
and resumes Agent work. Eight Agent attempts aimed at the human-owned surface
were rejected with zero committed mutations, while every background surface
continued progressing. The fixed Host remains byte-identical. The retained
receipt is
`admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v1.json`,
bound to implementation commit `c7d4dd7d9be63aa39ebe0b7f6e0dea661264cd53`.
This v1 evidence covers UIKit surfaces only; real WKWebView surfaces, DOM/frame
query, physical devices, lowering, admission and release remain pending.

The v2 successor hardens the handoff interaction without changing the fixed
Host. Agent-owned task surfaces reject direct user activation, all five surfaces
can collapse into one edge-dock entry while their Agent work continues, and the
waiting surface first opens a read-only preview. Human ownership is transferred
only after a separate explicit confirmation; only then are human input controls
enabled. During that ownership interval nine Agent actions were rejected with
zero committed mutations, while the other surfaces continued. The retained v2
receipt is
`admission/host-lib-defined-boundary-v1/ios-arm64-app-surface-control-v2.json`,
bound to implementation commit `d5620d1e83b36a4181a4f114d1c047f1d78be418`.
This remains a UIKit-only simulator qualification; WKWebView/DOM, physical
device, lowering, admission and release remain pending.

The mapped-window, epoll-readiness, kernel-splice and asynchronous-readiness
successors are qualified on local Linux aarch64 and independent GitHub Ubuntu
x86_64. The ioctl call-shape and vectored-write successor is also qualified on
local Linux aarch64 and independent GitHub Ubuntu x86_64. WIT is parsed by pinned
`wasm-tools` before native qualification. Wasm lowering, the Host Completion bridge and
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

The first x86_64 asynchronous-readiness attempt was rejected during strict C
compilation because the Ubuntu libc declaration required the destructor's
`write` result to be consumed. The retained rejection receipt is
`admission/host-lib-defined-boundary-v1/linux-x86_64-async-readiness-v6-compile-rejection.json`
for workflow run `36301745708`; it is not qualification evidence.

The remediated asynchronous-readiness Linux aarch64 receipt is
`admission/host-lib-defined-boundary-v1/linux-aarch64-async-readiness-v6-r2.json`,
bound to implementation commit
`785d276de16eb47371862cc79674bcbd6e5ce27b`.

The remediated asynchronous-readiness Linux x86_64 receipt is
`admission/host-lib-defined-boundary-v1/linux-x86_64-async-readiness-v6.json`,
bound to successful workflow run `36301909558` at commit
`db21881717edb3dec755c6d201954ad22c72396b`.

The ioctl call-shape and vectored-write Linux aarch64 receipt is
`admission/host-lib-defined-boundary-v1/linux-aarch64-device-io-v7.json`, bound
to implementation commit
`b9c5c52668131765f8a3539b96f8241320462b27`. It explicitly retains real uinput,
UHID, hidraw and USB Gadget device-backed qualification as pending.

The ioctl call-shape and vectored-write Linux x86_64 receipt is
`admission/host-lib-defined-boundary-v1/linux-x86_64-device-io-v7.json`, bound
to successful workflow run `36302980800` at commit
`6e171c3bd1f85e510618d7f23ef4ec4c3303ddb5`.

The separate Lib-defined UInput Linux aarch64 receipt is
`admission/host-lib-defined-boundary-v1/linux-aarch64-uinput-v1.json`, bound to
implementation commit `e5fc048c707edc361aad825bcc51cc2ce1fee377`.
The matching independent Linux x86_64 receipt is
`admission/host-lib-defined-boundary-v1/linux-x86_64-uinput-v1.json`, bound to
successful workflow run `36318024206` at the same commit. Together they close
the real-uinput device gate without adding a UInput API or semantic branch to
the fixed Host. They do not admit or release the Lib, and do not close WIT-to-
Wasm lowering.

The Lib-owned TCP socket Linux aarch64 receipt is
`admission/host-lib-defined-boundary-v1/linux-aarch64-socket-v1.json`, bound to
implementation commit `882167596f2e5791d1461f7d5a2f78e56d1382b5`.
It explicitly records `https_transport_migrated=false`.

The matching Linux x86_64 receipt is
`admission/host-lib-defined-boundary-v1/linux-x86_64-socket-v1.json`, bound to
successful workflow run `36304676571` at commit
`545cfc3b358cd5dcc4cd881fc832676c63ae7e59`. It independently records
`https_transport_migrated=false`; together these receipts close only the
cross-architecture physical TCP slice, not the HTTPS migration gate.
