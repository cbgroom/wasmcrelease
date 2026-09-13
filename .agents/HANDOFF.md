# WAsmC release maintainer handoff

## 0. Status

Main acceptance now includes browser/resident engine and bounded JS supervisor.
Resolve exact sources/runs from admission/host-browser-engine-qualification.json
and admission/host-supervisor-qualification.json. Independently read14supervisor
and3browser recovery receipts; all six desktop/three browser/required cells PASS.
Native owner and Kernel exact acceptance is recorded in
admission/host-native-kernel-qualification.json. Lifetime/negotiation/half-close
remain subsequent independent candidates requiring their own qualification.
The historical sections referenced below retain their earlier evidence scope.

Active source line: work/host-scoped-owner-lifetime, following Native owner and
Kernel branches. Metadata consolidation: work/host-handoff-consolidation.
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
Kernel and Native internal owner registry are now qualified; scoped lifetime,
negotiation and half-close source require their own exact acceptance before main.
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
injected failed ack -> real shutdown/peer EOF with one read.12guard/5TCP tests.
This is internal Host Rust, not general async recovery/guest ABI. Underlying
raw guard terminal32767-owner process budget is explicit in NATIVE_SUPERVISOR.md.
Mac ARM Bun Kernel CI empty sync-spawn stdout is corrected with event-driven
spawn/pipe-drain/close, no replay. Changed source requires own qualification.

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

Next: inspect latest scoped lifetime/negotiation/half-close runs in both workflows;
fix real failures locally while CI runs. Kernel Bun pipe-drain fix belongs to
Native owner source; old failed Kernel run does not qualify changed source.
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
