# WAsmC release maintainer handoff

## 0. Status

Active slice: shared bounded read reactor, maximum16owned reads, one OS
queue/wakeup, independent cancellation and absolute deadlines. Reuse existing
NativeOwnerSupervisor pins/quota/close fences. No guest ABI or Host syscall.
Prior run34769384047 complete PASS; new source needs its own receipts.
Local output admission remains64MiB, start46428KiB; no engine-cache writes.
Guest Future/typed transport remains a later slice, not claimed by reactor tests.
Local completion: default25/25 and readiness38/38 PASS, including7shared-reactor
controls; strict readiness Clippy,fmt and existing JSfault/lifetime regressions
PASS. Output46536KiB remains below65536KiB. Reactor reuses scoped supervisor,
never-reused private tokens, close acknowledgement and bounded in-flight quotas.
Fatal inconsistent backend control proves retained pin and denied admission.
Prior single-owner run's six exact-source receipts have been downloaded and
their input digests compared with Git; retained under
.agents/workstreams/host-readiness/single-owner-receipts. They do not qualify
this new reactor. Cross-platform milestone requires own38test receipts on3OSes.
Local implementation100%; full Host gate acceptance remains1/5(20%). Next:
guest Future delivery with bounded queued-result lifetime, then typed Core SDK.

Previous single-owner slice: optional native-readiness using OS readiness and a
cross-thread cancellation wakeup, without sleep polling or internal worker
creation. Explicit opt-in; default completion crate dependency graph unchanged.
Reuse one owned read and supervisor close fences; close cancellation wakeup
resources on settlement so stale cancellation cannot affect a new owner.
Prior three desktop receipts downloaded and independently checked: source
resolve from Git previous implementation commit,25passed,clean,all3OS PASS;
run34769045498. Source-bound receipts are retained in
.agents/workstreams/host-readiness/previous-receipts; all recorded input hashes
were independently compared with the referenced Git objects. They qualify only
the previous owner implementation, not this new optional readiness Source.
Resource admission remains64MiB local target; no engine-cache writes. Start
measurement35456KiB; stop if the small optional graph reaches65536KiB.
Current local result: default25/25 and readiness31/31 PASS; both profiles strict
Clippy PASS,fmt/JSfault10/lifetime80000/YAML PASS. Actual OS readiness, deadline
and cross-thread cancellation tests include no production sleep polling;
cleanup retires wakeup and suppresses old cancellation. Local target46424KiB,
within64MiB. Existing downstream default Cargo lock resolves without mutation.
New milestone workflow requires both profiles on all3desktop OSes; qualify it
against its own exact-source downloaded receipts before main integration.
Implementation slice locally100%; complete Host acceptance still1/5(20%).
At that checkpoint, next was shared reactor and guest Future adapter; the
single-owner wait is not an executor or complete typed Core async transport.

Earlier checkpoint: nonblocking TCP read owner. This adds no Host import or
guest ABI. Start from accepted main (resolve parent with Git). Implemented a
preopened, exclusive socket owner that performs only nonblocking reads, checks
cancellation/deadline before each read and closes its owned descriptor before
settlement. Reuse NativeOwnerSupervisor for scoped identity and retained quotas.
Local-first; existing desktop Actions qualify portability, not mobile devices.
Resource admission: outputs at most64MiB in ignored local target, including
the small standalone completion crate's release-only Cargo graph (no engines);
no engine Cargo rebuild or writes to the over-budget private pool.
Existing engine caches remain untouched. Typed async guest transport and a
readiness reactor remain separate unqualified gates; polling is not a reactor.
Local qualification: release completion crate25/25 tests, warnings-denied
Clippy and fmt PASS; JS fault10/snapshot9 and80000lifetime cycles PASS;
maintainer/integrity and workflow YAML syntax PASS. Local output35456KiB is
within65536KiB admission. scripts/test-host-nonblocking-read.mjs binds exact
Git source, dirty-state and three implementation digests in reproducible receipts.
New dedicated Actions emits independent Linux/macOS/Windows receipts; no
cross-platform acceptance is claimed until downloaded exact-source receipts.
This implementation slice is locally complete; Host delivery remains1/5gates
(20%). Next: readiness/timer/cancel wakeup adapter, then typed Core async SDK.

Portable Std1.4.1 source-free candidate passed all18exact-source Actions cells.
It is admitted for main integration, not an immutable prod/discovery winner.
Resolve exact source/run/job receipts from
admission/portable-std-v0/qualification.json;107520paired calls passed across
15JS and3Native dual-engine cells. This containing global-only receipt changes
no executable/package bytes from the qualified Source. Main promotion still
requires exact parent check and remote readback; no formal prod/tag is advanced.
Resolve exact private
source, regenerated package identities, toolchain and local results from
admission/portable-std-v0/manifest.json. Local private Std suite10/10 and public
Node18/Node26/Bun/Deno plus Wasmi2/Wasmtime47 paired execution passed.
Public native glue was locally compiled directly against compatible warm
dependencies; full Cargo cross-platform compilation passed all3Native cells.
The new workflow requires15JS cells plus3native cells (both engines), exact
checkout-SHA receipts,13JS rejection controls and frozen64product integrity.
All18required cells now independently verified PASS from downloaded receipts.
No compiler source is published; old1.4.0 and prod pointers remain unchanged.
Next: verify main publication of this receipt with unchanged qualified inputs;
embedded catalog/search and immutable release promotion remain separate.
Local Deno initially rejected unnecessary child-process environment access;
the runner now records CI SHA without spawning Git. Actions checks Git itself.
Bounded local output is not exhaustive73API edge or mobile-device qualification.
Initial candidate Actions passed Linux/macOS JS, but Windows rejected exact
input identity before execution because checkout applied CRLF conversion.
The delivery attributes now preserve all bytes; the owning integrity Skill
records this lesson and the CRLF negative/real checkout controls passed allOSes.
No admitted payload was edited; generated SDK's trailing blank-line diff
warning is deliberately preserved as exact private-producer byte identity.
The corrected complete18-cell run is now PASS; its exact Source remains the
execution authority and previous failure receipts are retained. Next: verify
main promotion, then integrate new version into a separately bound future
catalog/search/release candidate without rewriting frozen prod inventories.

Compiler protection is explicit: source/internal implementation remains private;
Wasmi/Wasmtime integration, Host adapters, CLI and conformance/build glue may be
public. User authorizes private compiler edits, not disclosure. Public CI only
consumes admitted artifacts; no private-source cache/log/archive leakage.
Portable Std investigation must first isolate producer/bindings/optimizer
features, not assume an engine rejection requires compiler changes. Current
frozen compiler and Lib artifacts remain unchanged by this policy checkpoint.

Main acceptance now includes browser/resident engine and bounded JS supervisor.
Resolve exact sources/runs from admission/host-browser-engine-qualification.json
and admission/host-supervisor-qualification.json. Independently read14supervisor
and3browser recovery receipts; all six desktop/three browser/required cells PASS.
Native owner and Kernel exact acceptance is recorded in
admission/host-native-kernel-qualification.json. Scoped lifetime is now accepted
via admission/host-lifetime-qualification.json; Core negotiation now accepted
via admission/host-negotiation-qualification.json. Half-close/quota/CoreLib
file-chain and retirement/snapshot source are accepted through
admission/host-corelib-stream-qualification.json. Later quarantine/UDP/mobile
sources require their own exact-source qualification.
The historical sections referenced below retain their earlier evidence scope.

File read bounds, TCP buffered-byte quotas, CoreLib packing snapshots and
malformed JS completion quarantine are now independently qualified through
admission/host-completion-bounds-qualification.json: both full workflows pass.
Each of four control suites has20 receipts including Linux fast; eight read
controls, ten buffer controls, seven Core snapshot controls, six completion
controls plus one actual TCP corrupted-completion case per receipt. Retained
owners require explicit close acknowledgement before drain; no I/O replay.
UDP prebound/fixed-peer candidate is now independently accepted through
admission/host-udp-qualification.json: both full workflows PASS.28Native pairs
(14Wasmi/14Wasmtime) each prove eight datagrams/five calls/three rejections,
zero foreign replies and retired resources.20JSfault receipts each have11controls.
This is loopback source filtering, not authentication, reliability or Native
async/mobile/browser UDP qualification. No new Kernel import or frozen product.
Native binary-only, UDP pending-send retirement, completion/write snapshots,
unknown guard retirement and portable mobile dependency gates are accepted via
admission/host-mobile-dependency-qualification.json. Both exact full workflows
PASS; four mobile target compile/dependency cells pass. This is compilation,
not mobile linking/install/device execution.20 guard-retirement receipts and14
UDP-retirement receipts are observed; the old folded Node command is not counted.
Later idle-pool and explicit-quarantine-cleanup candidates remain unqualified.
Resolve exact revisions with Git; inspect
status/worktrees before editing and preserve unrelated changes. Linked worktrees
belong under /Users/youxianshi/code/.worktrees/wasmcrelease.

Main already contains qualified scoped identity, TCP/read-stop/listener,
resident WAsmC App and write-outcome work. Resolve origin/main live and read
admission/host-transport-qualification.json and
admission/host-resident-write-qualification.json for accepted exact sources,
runs, independently read receipts and scope. Do not redo those implementations.

Optional Wasmtime, benchmarks, failed-stop/error-path protection,
real browser probes and bounded JS quarantine supervisor are accepted in main.
Kernel, Native internal owner, scoped lifetime and negotiation are accepted.
Stream/CoreLib candidate passed both complete workflows and mandatory Linux fast.
Early queued endpoint construction and persistent data ownership resolve the
locally reproduced Bun/Linux header loss. Preserve historical failed evidence
in host/tcp/linux-frame-regression.json. Removed readable experiment failed Deno.
28 service pairs, 28 CoreLib file pairs and 28 lifetime pairs pass: each consumer
100000 cycles, checksum14342320, warm CoreLib memory1310720bytes stable, earliest
stale reference rejected. JS owners end empty; Native drops100000 per caller.
File pairs cover eight real cases, ten JS controls and eight Native cases.
Raw signed i64/status fixtures are private curated ABI, not typed Agent SDK or
hostile admission. Frozen compiler derived i64 comparison remains defective;
typed canonical intermediates are a workaround, not a producer fix.
Seven stream and seven file-write snapshot controls pass. Snapshot bytes are
captured before async I/O and completion lengths checked, never replayed.
Native owner fifteen-test suites quarantine malformed settled completion;
primary versus retirement failures retained. Four driver retirement controls
plus real TCP and three endpoint controls retain refs until close acknowledgement.
Only explicit retirement retries close. Generic guard-release faults and Native
async/OS races remain outside scope. Native-peer half-close is positive; Bun
JS-client half-close remains negative characterization. Bun/Deno setup ordering
is corrected; older defective workflows cannot qualify this source.
Never borrow an old-source PASS. No release/tag/deployment was performed.

Idle-guard reuse is now qualified through admission/host-guard-pool-qualification.json:
both whole workflows PASS;20 five-control suites and3 actual browser reuse probes
are independently read. Private scoped counters never reset; only acknowledged,
empty, unrevoked, unexhausted guards enter the owner-bounded pool. Pending and
all quarantine remain excluded, even with zero records. Native pooling and full
performance/release acceptance are not implied. Explicit-quarantine cleanup, fail-closed entrypoint ordering, locked dependency
caches and resident input snapshots now qualify through
admission/host-resident-snapshot-qualification.json. Both whole workflows PASS;
20 suites each cover9 resident,6 cleanup,5 pool and12 UDP retirement controls.
Three actual browsers additionally cover3 resident capture cases and1 unknown
cleanup case. Node-only and three-engine entrypoint checks each have6 receipts.
Core28ordinary/28negotiated receipts retain canonical digests/denials/failures.
Only metadata/docs follow that qualified product source; no runtime diff.
Local paired observations remain local in resident-snapshot-performance.json,
not full performance/release acceptance. Full Host gate count remains1of5.

## 1. North Star

Core/Lib performs algorithms and memory management; public Host owns authority,
transport mechanics, limits and cancellation. Compiler/CoreLib binaries and
frozen SDK remain unchanged. Verify channels/candidates/0.0.10.json frozen
product hashes before promotion. Do not rebuild frozen compiler/provider or
rewrite immutable tags. Public mutable Host glue may evolve independently.

## 2. Current Focus

Default reference build is Wasmi-only. Optional wasmtime-engine enables exact
reviewed Wasmtime runtime/Cranelift without WASI. Resident App/Lib/slab and
per-call Native fuel are reused. Trapped App is poisoned; no replay/promotion.
Browser ESM uses no Node shims; raw TCP and mobile qualification are not implied.

Cancellation is not rollback. Post-issue write may have partial external effect.
Wait issued I/O plus close acknowledgement before drain/recycle. Failed stop
retains/revokes owner state; supervisor quotas count active plus quarantine.
Only explicit verified termination/retirement frees it. No fabricated ack or
business I/O replay; never-settling backends require outer isolation.

## 3. Existing Evidence

Local Node/Bun/restricted Deno passed resident1000call parity, read/write matrices,
six failed-stop, ten ordinary-error and fourteen supervisor controls. Real local
Chrome/Firefox/WebKit passed App/Lib/guard/quarantine/admission/recovery probes.
Receipts identify exact App/Lib digests. Pure microbenchmark observed Native
Wasmi about216-230ns and Wasmtime about69ns per two-byte App/Lib call; not an
exact-source qualified performance guarantee. Repeat at accepted source.

Kernel scalar simulator now has explicit optional Wasmtime profile, default
Wasmi-only. Local four Core cases agree with JS; browser probes also run the
same digest-bound kernel. This is simulator-only, not canonical typed SDK.
Both Native profiles reset fuel per call; no hidden WASI or guest authority.

Native owner registry adds scoped quota/ownership return/settled completion/
quarantine with exclusive borrow, four unit controls plus actual TCP timeout ->
injected failed ack -> real shutdown/peer EOF with one read.14guard/5TCP tests.
Fresh CSPRNG scoped guards use private binding-local integers; injected identity
constructors and raw guards keep global exhaustion protection. JS/Native owner
registries rotate identity only when exhausted AND completely empty. Local
40000 guard and 40000 registry cycles pass, live quarantine blocks rotation,
old epoch tickets remain invalid. See host/completion/LIFETIME.md; this is not
general async recovery/guest ABI or long-run RSS/network qualification.
Mac ARM Bun Kernel CI empty sync-spawn stdout is corrected with event-driven
spawn/pipe-drain/close, no replay. Changed source requires own qualification.

Bounded Core describe now exposes profile version/copy feature/limits without
new Host imports. Negotiated guest performs preflight before allocation/invoke.
Local six JS/Native engine pairs pass four lengths and seven denial cases;
Native denies with zero non-describe calls/resources/effects. Typed WIT SDK and
arbitrary-device description are not implied. Owning host/v0/NEGOTIATION.md.

## 4. Plan and Validation

Read release-host-integration, release-integrity and release-agent-docs Skills.
Run scripts/maintainer-orient.sh. Develop and verify locally, batch milestones;
queued Actions does not block development or permit unqualified promotion.

Build: cargo build --release --locked --features wasmtime-engine
--manifest-path host/lib-e2e/rust/Cargo.toml. Use one shell command line.
Owning runnable commands and limits:
- host/tcp/ENGINE_PROFILES.md: identical resident App/Lib on both Native engines.
- host/tcp/BENCHMARK.md: checksummed pure compute; not network/durable TPS.
- host/tcp/READ_STOP.md and WRITE_OUTCOMES.md: issued-I/O/partial-effect fences.
- host/tcp/STOP_FAILURE.md and SUPERVISOR.md: retained ownership and bounded quota.
- host/browser/README.md: actual Chrome/Firefox/WebKit probes, not phone emulation.

Before commit: refresh-integrity.mjs, validate-maintainer.sh, actionlint,
git diff --check; stage only own changes and verify remote recovery.
Host Actions now requires six Native desktop plus three browser cells, both
engine correctness paths and benchmark checks. Read actual per-case receipts.
Cancel obsolete known-defective own runs only; never weaken required gates.

## 5. Current Action

Full Host delivery denominator is five gates from host/v0/README.md, not
all-standard-library coverage. Only gate1 is currently fully accepted:20%.
Do not count locally completed slices as all-platform/full SDK completion.

## 6. Next Actions

Next: typed guest transport/SDK and full Std portable proof under their owning
producer workstreams. See host/TYPED_TRANSPORT_REVIEW.md. Public Host-only
fixtures cannot substitute for generic typed guest I/O; producer scope is not
transferred here. No new compiler semantics by default, no frozen byte rewrite. Earlier
accepted sources need no redo.
Accept relevant source only with exact receipts, merge current main metadata
without discarding it, refresh integrity, then normal expected-base FF promotion.
Continue typed Core transport/SDK and Native supervision parity afterwards.

## 7. Boundaries

Still unclosed: reviewed typed guest async/resource transport; full browser/
Wasmtime adapter acceptance; Native failed-stop/race and blocked-write
preemption; generic never-settling containment; Bun half-close response parity;
TLS/device/system Lib integration; full Std portable Wasmi/Node18 (Heap-only
fixtures are not a substitute); mobile link/sign/install/device runtime;
full performance/memory qualification and
immutable Host SDK release. No unsafe API freeze or production claim.

## 8. Recovery

Complete previous handoff preserved verbatim under
.agents/history/host-handoff-before-consolidation.md and in Git.
Its claims are chronological checkpoints, not current acceptance authority.
Use live Git and the current admission files to resolve source/integration truth.
