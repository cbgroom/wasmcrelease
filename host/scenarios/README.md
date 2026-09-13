# Host v1 scenario qualification matrix

This is a selected acceptance plan, **not a claim that v1 is implemented**.
Use [the API baseline](../CORE_API_V1_BASELINE.md) and
[machine-readable scenario plan](plan.json). Every candidate family is covered
by a planned behavior, not counted accepted by a matching function name.

## Selected scenarios

| ID | Scenario and common oracle | Candidate mechanism families |
|---|---|---|
| S1 | Granted clock/entropy -> App validates timestamp/nonce -> CoreLib encodes response; no grant and unavailable source reject | describe, clock-read, entropy-fill, windows, release |
| S2 | Granted input -> read -> CoreLib transform -> write -> explicit sync -> independently reopen/compare output; no ambient paths | describe, open, read, write, invoke, wait, windows, release |
| S3 | Granted HTTP origin -> bounded request/response -> App/CoreLib validate body; cancel/timeout do not publish response | describe, open, read, write, invoke, wait, cancel, windows, release |
| S4 | Resident TCP server/client and fixed-peer UDP; multiple sessions, message/EOF/half-close correctness, bounded quotas | describe, open, read, write, invoke, wait, cancel, windows, release |
| S5 | Across S1-S4: cancel, operation versus wait deadline, quota exhaustion, stale/foreign/duplicate completion, failed retirement | describe, wait, cancel, release, windows |

"windows" above expands to window-acquire/window-commit. S1 uses invariant
oracles: entropy outputs need not equal between consumers; wall time accuracy,
monotonic precision and secure-entropy quality are not proved by availability.
S2 sync acknowledgement is not automatically crash/power-loss durability.
S3's Native CoreLib HTTP/TLS and browser-fetch contracts must be explicitly
distinguished. A fetch adapter is not proof of raw TCP or CoreLib TLS portability.
TLS crypto/trust/interoperability requires independent reviewed qualification.
S4 is an extension scenario, not a mandatory browser capability.

## Platform targets and explicit gaps

| Platform | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|
| Node/Bun/Deno on Linux/macOS/Windows | source preflight, then v1 binding | scoped OS-file adapter | origin-restricted client | granted TCP/UDP/service | real backend lifecycle |
| Wasmi/Wasmtime on Linux/macOS/Windows | shared Native source/binding | same scoped-file contract | CoreLib protocol over granted transport | shared Native backend, both engines | same completion/retirement oracles |
| Chrome/Firefox/WebKit | secure-context source, then binding | optional permission-bound browser storage | explicit browser HTTP-client contract | raw TCP/UDP/listen unsupported; test rejection | supported real storage/HTTP only |
| iOS/Android/HarmonyOS Native | real device required | granted device storage | permitted network client | OS/permission-specific optional extension | device cancellation/restart/lifetime |

No all-platform runtime success is claimed from desktop CI or mobile compile.
Browser storage is not Node's filesystem; unavailable permissions/features must
reject, not use a Blob and call that persistent storage. Native is not limited
to browser features. Unsupported capability controls are positive security tests
but **not positive execution coverage** for the unavailable capability.

## Evidence levels and next work

### Three focused maturation journeys

Keep the five acceptance scenarios unchanged, but iterate through three grouped
journeys rather than growing the test catalog:

| Journey | Reused executable path | Main unresolved acceptance |
|---|---|---|
| File (S1/S2) | `file-app-test.mjs`: real read -> compiled WAsmC App -> admitted Lib -> committed write -> sync -> independent disk oracle | ordinary guest-initiated typed I/O, Rust/Native equivalent carrier |
| Resident network (S3/S4) | `../tcp/server-test.mjs --js-only`, `../udp/test.mjs`: actual framed service and fixed-peer datagrams with resident App/Lib | uniform carrier and reviewed HTTP/TLS composition |
| Failure/retirement (S5) | file cancellation/trap/readonly plus `../tcp/stop-failure-test.mjs`, existing root/window and completion controls | actual backend race/stop and unified guest Future cleanup |

The file journey runs four real positive inputs and four negative paths for
each independently compiled WAsmC/Rust caller (8 positives/8 negatives per
runtime) on Node/Bun/Deno locally. Sync failure is a controlled fault: written
bytes remain visible, durability is not acknowledged, and neither App nor sync
is automatically replayed. This is not OS crash/recovery evidence.
TCP locally verifies 19 connections, 17 accepted frames,
two rejected frames and 1,000 resident calls; UDP verifies five accepted and
three rejected messages. Stop-failure controls deliberately inject faults;
they are not positive OS stop proof. These are restricted vertical fixtures,
not uniform v1 acceptance. In the file fixture the trusted embedding initiates
I/O and the ordinary guest performs the Lib computation; do not label it a
guest resource SDK. Cancellation is ordered delivery suppression, not OS abort.
Previous WAsmC-only file candidate Actions 34772492928 completed all nine jobs
PASS on three OSes. The new dual-caller source requires its own qualification;
Actions compiles the Rust caller with pure rustc and retains nine file receipts.

```sh
rustc --edition=2024 --crate-type cdylib --target wasm32-unknown-unknown \
  -C opt-level=s -C panic=abort -C strip=symbols -D warnings \
  host/scenarios/file-app.rs -o target/nonblocking-read/file-rust.wasm
node host/scenarios/file-app-test.mjs target/nonblocking-read/file-rust.wasm
bun host/scenarios/file-app-test.mjs target/nonblocking-read/file-rust.wasm
deno run --allow-read --allow-write host/scenarios/file-app-test.mjs target/nonblocking-read/file-rust.wasm
node host/tcp/server-test.mjs --js-only
node host/udp/test.mjs
node host/tcp/stop-failure-test.mjs
```

1. Platform source preflight: real OS/browser source availability. New S1 probe
   checks WebCrypto, monotonic and wall clocks; Native uses getrandom/Instant/
   SystemTime. It does not implement describe/entropy-fill/clock-read guest calls.
2. Existing adapter evidence: file, resident, UDP, guards and shared readiness
   fixtures already have their own scoped receipts. Reuse, do not relabel as v1.
3. v1 typed binding: reviewed semantic WIT/carrier, scoped SDK and quotas.
4. Ordinary WAsmC and Rust Apps: same typed semantic contract and expected
   behavior using actual CoreLib, both Native engines and supported JS hosts.
5. Platform acceptance: exact source/artifact/config receipts, real I/O output,
   errors/cancellation, stop/close and payload/resource budgets.

All scenarios currently have **planned** uniform-v1 execution status. Passing a
preflight/adapter does not advance that status. Platform absence is separate
from missing implementation. First close S1 typed round-trip plus one S2 vertical
read/process/write path; then S3/S4, with S5 required throughout. Don't let new
Host-only fixture work postpone the typed App path.

The [S2 implementation review](TYPED_FILE_PATH.md) records the carrier/lifetime
requirements and the actual App acceptance gate before signatures are fixed.
It is a proposal, not an additional API baseline or accepted SDK.

Desktop run [34771863772](https://github.com/cbgroom/wasmcrelease/actions/runs/34771863772)
completed all nine jobs against source
`3eb64351e057a18a1412f6b36b50faeb74864290`. Independently downloaded 21 receipts
pass exact Git-source/input-digest and narrow evidence-level review: nine
component, nine JS S1 and three Native S1 receipts. Caller binary digests agree
across all receipts; this review alone does not rebuild the binaries or prove
runtime identity independently of the workflow. Uniform v1 remains unaccepted.

```sh
gh run download 34771863772 --dir target/all-api-qualified-receipts
node host/scenarios/verify-desktop-receipts.mjs target/all-api-qualified-receipts \
  3eb64351e057a18a1412f6b36b50faeb74864290
```

Local preflight commands (default tested JS sources require no FS/network grant):

```sh
node host/scenarios/environment-test.mjs
bun host/scenarios/environment-test.mjs
deno run host/scenarios/environment-test.mjs
cargo test --release --locked --manifest-path host/completion/rust/Cargo.toml --test environment
```

For browsers, invoke `probeEnvironment` in a real secure-context page and retain
browser/source receipts; Node execution is not browser proof. The probe's
injected missing-source controls are explicit negative tests, not positive
simulated sources. No insecure fallback, numerical guest handle or JSON RPC.

## S1 restricted App/Lib/Host profile

`environment-app.wasmc` and `environment-app.rs` implement the same synchronous
logical interface. Each App initiates two monotonic clock reads and one real
secure-entropy fill, then calls the admitted `wasmc-owned-algorithms` Lib to
sum the sixteen initialized bytes. The embedding owns the scratch window;
neither caller sees a pointer, resource token or opcode. The `nonce_sum` import
is fixture Lib marshalling, **not a new Host mechanism** or public standard API.

This is a restricted scalar validation profile, not a generated typed v1 SDK:
implicit prebound capabilities/windows, thrown embedding errors and no async
operation/result/resource carrier. It does not qualify describe, public window
acquisition/commit/release, wall clocks, revocation or cancellation. Do not copy
these physical imports into the final v1 ABI. Formal SDK/package production
still belongs to its owning producer workstream.

Each runtime checks 64 real-source App calls (32 per caller), one paired replay
oracle and four denial/unavailable-source controls. Replay uses one captured
real input solely to compare pure consumer behavior; it is not entropy evidence.
Denied/unsupported paths cannot call the Lib. Scratch is cleared/freed on both
success and failure; retained binding callbacks reject after retirement. These
are fixture-lifecycle checks, not long-run allocator/RSS or cryptography proof.
Actions retains nine exact-source JSON receipts across three desktop OSes.

```sh
rustc --edition=2024 --crate-type cdylib --target wasm32-unknown-unknown \
  -C opt-level=s -C panic=abort -C strip=symbols \
  host/scenarios/environment-app.rs -o target/nonblocking-read/environment-rust.wasm
node host/scenarios/environment-app-test.mjs target/nonblocking-read/environment-rust.wasm
bun host/scenarios/environment-app-test.mjs target/nonblocking-read/environment-rust.wasm
deno run --allow-read host/scenarios/environment-app-test.mjs target/nonblocking-read/environment-rust.wasm
```

Native shares the same App/Lib bytes and restricted semantic profile:

```sh
cargo build --release --locked --manifest-path host/lib-e2e/rust/Cargo.toml \
  --features wasmtime-engine --bin environment-app-reference
node host/scenarios/environment-native-test.mjs \
  host/lib-e2e/rust/target/release/environment-app-reference \
  target/nonblocking-read/environment-rust.wasm --wasmtime
```

Windows adds `.exe`. Default compilation without `wasmtime-engine` remains
Wasmi-only; omit `--wasmtime` to test it. Each engine executes 64 real OS-source
calls, two explicitly controlled consumer oracles and four rejection controls.
Nonce scratch is cleared and the private Lib slab freed on success/denial.
Both App and Lib have finite fuel; input and callback counts are bounded.
These trusted fixtures do not provide arbitrary hostile-module admission,
general Store memory limits, asynchronous completion, wall-clock preemption,
automatic promotion, replay or a formal generated guest resource SDK.
The twelve-family uniform-v1 plan remains planned. Native Actions requires
default and dual-engine strict checks plus full locked Cargo compilation on
Linux/macOS/Windows; local direct linking with warm exact-version dependencies
is only local validation, not that Cargo or cross-platform proof.

## Twelve-family component coverage

`all-api-test.mjs` executes behaviors mapped to the single baseline inventory;
it is **not twelve functions implemented behind one accepted Core ABI**.
Each receipt reports the narrower evidence level and keeps v1 acceptance false.
No memory-device simulator is used by this suite.

| Families | Actual test path | Remaining v1 gap |
|---|---|---|
| describe/open | bounded named preopened file grants, detached description, rights attenuation, single child transfer | typed selectors/endpoint carrier; arbitrary OS open not granted |
| read/write/invoke/release | real disk bytes/EOF/ranges, readonly rejection, finite storage sync, actual close and busy retention | generic typed invocation/results and asynchronous closing |
| wait/cancel | real issued file read plus correlated scoped guard; cancelled payload discarded only after settlement | generic batch wait, wait/operation deadlines, guest Future and OS cancellation races |
| window-acquire | scoped guard resource/size quotas, foreign and stale rejection | formal external-window SDK/carrier |
| window-commit | bounded initialized copy window, real file write, captured snapshot, pinned mutation/release rejection | interoperable Core resource/memory carrier |
| clock-read/entropy-fill | real monotonic/wall/WebCrypto sources; S1 App path tested separately | uniform authorized endpoint/window binding |

Per runtime: 24 rejection controls in the twelve-family suite, 12 root ownership
controls and 13 write-window controls. Real-I/O positives and deliberately
controlled fault negatives are separately labelled. Failed root close retains
ownership, denies subsequent business use and retries only explicit retirement.
Write windows await actual issued backend settlement, never timeout-unpin or
automatically retry. Reentrant source getters cannot mutate a newly pinned window.
These Host-side windows are external-I/O copies, not ordinary CoreLib allocation.

```sh
node host/scenarios/all-api-test.mjs
bun host/scenarios/all-api-test.mjs
deno run --allow-read --allow-write host/scenarios/all-api-test.mjs
node host/file-io/root-test.mjs
node host/file-io/write-window-test.mjs
```

Fault suites also run unchanged on Bun and Deno without grants. The Deno
real-I/O harness uses its native temporary-directory primitive and needs no
environment/network/process grant. Desktop Actions retains nine component
receipts (three runtimes × three OSes), including exact checkout and input hashes.
Native S1 is separately qualified; this suite does not establish Native parity
for these new adapters, browser storage, mobile execution or all-endpoint support.
