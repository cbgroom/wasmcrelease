# WAsmC release maintainer handoff

## 0. Status

Active source line: work/host-corelib-bytes-io. Task state: started.
Objective: restricted settled file bytes -> exact existing CoreLib Provider ->
reviewed WAsmC/Rust physical-ABI conformance callers -> verified output.
Use producer authority and published signatures, never guess opaque ABI or
rebuild compiler/provider. Raw references stay in curated private-ABI fixtures,
not Agent-facing SDK. Plan: local JS proof, Native parity, fault/cleanup controls,
exact milestone CI then main acceptance. No new Host syscall or language memory
model, std artifact substitute, product tag or production SDK claim. Resume:
implement host/corelib-io using provider digest from examples/current/standard.mjs.
and handoff consolidation. Resolve exact revisions with Git; inspect
status/worktrees before editing and preserve unrelated changes. Linked worktrees
belong under /Users/youxianshi/code/.worktrees/wasmcrelease.

Main already contains qualified scoped identity, TCP/read-stop/listener,
resident WAsmC App and write-outcome work. Resolve origin/main live and read
admission/host-transport-qualification.json and
admission/host-resident-write-qualification.json for accepted exact sources,
runs, independently read receipts and scope. Do not redo those implementations.

Optional Wasmtime, benchmarks, failed-stop/error-path protection, real browser
and bounded JS supervisor are now accepted in main. Read the current admission
host-browser-engine-qualification.json and host-supervisor-qualification.json
from main for exact receipts. Kernel, Native owner, lifetime and negotiation
source initially required their own qualification. Native owner and Kernel are
now accepted; resolve admission/host-native-kernel-qualification.json in main.
Lifetime/negotiation/half-close/quota source still require their own qualification.
Never borrow an old-source PASS. No release/tag/deployment was performed.

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
injected failed ack -> real shutdown/peer EOF with one read.14guard/6TCP tests.
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

Half-close probe fixes accepted socket inheritance of trusted server policy;
local Node/Bun/Deno -> independent Rust peer all receive reply after peer FIN.
Native EOF -> write -> explicit retire test also passes. Node/Deno JS peers
pass; Bun1.3.14 macOS ARM JS client still loses reply. Characterization records
accepted=false/profile_supported=false, never counts as positive parity.
See host/tcp/HALF_CLOSE.md; no new Host import/private-runtime workaround.

Negotiated caller now preserves allocation/commit/submission errors instead of
continuing with negative handles. Local quota proof fixed -3 -> misleading -4.
Five new JS/Native failure controls pass all six runtime/engine pairs; unknown
completion retains pending window/operation, not forced free. Receipt cleanup
scope excludes preexisting owners and unknown-completion quarantine. Actual
Native/Kernel work already qualified; new caller source still needs exact CI.

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

Next: inspect latest core-quota-safety exact runs (Host composition and Core
Host contract); fix real failures locally. Prior accepted source needs no redo.
Accept relevant source only with exact receipts, merge current main metadata
without discarding it, refresh integrity, then normal expected-base FF promotion.
Continue typed Core transport/SDK and Native supervision parity afterwards.

## 7. Boundaries

Still unclosed: reviewed typed guest async/resource transport; full browser/
Wasmtime adapter acceptance; Native failed-stop/race and blocked-write
preemption; generic never-settling containment; Bun half-close response parity;
TLS/device/system Lib integration; full performance/memory qualification and
immutable Host SDK release. No unsafe API freeze or production claim.

## 8. Recovery

Complete previous handoff preserved verbatim under
.agents/history/host-handoff-before-consolidation.md and in Git.
Its claims are chronological checkpoints, not current acceptance authority.
Use live Git and the current admission files to resolve source/integration truth.
