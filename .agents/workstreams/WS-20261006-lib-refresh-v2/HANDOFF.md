# Lib Refresh V2

## Current checkpoint: full-index Search Q2 PASS

Read search-storage-q2-checkpoint.json for exact source, index, provider, runner
and immutable receipt hashes.40/42 source identities; Std/Resident pending.
Only libspec authoring and normalized v2 index; no old-format/source fallback.

Search complete Root:3 APIs/7 cases/4 rounds on each of Wasmi2.0.0/Wasmtime49.0.2,
28 calls per engine. Full35232-byte index retains40 packages/153 APIs/193 logical
entries.27 direct Core Q1 tests, including193 exact lookups, pass.
JSON3 APIs/9 cases/8 rounds and Owned4 APIs/6 cases/8 rounds were rerun on the
same provider:72/48 calls per engine. Total actual runtime calls296.

Two generic gates were fixed: provider's1KiB storage and Native projection's
128-byte fixture cap. Shared2MiB byte pool retains owner/type/borrow/UTF8/clone/
clear/drop semantics. Native plans align with the existing2MiB snapshot budget;
explicitly pinned smaller limits remain enforced. Experimental provider is an
independent exact input, not a rewritten released artifact.18 full provider tests,
10 overlapping minimal tests,47 compiler tests and39 release regressions pass.
Raw/packed initial memory is identical at3670016 bytes. The38567-byte packed
artifact is not the runtime footprint.170 current source inputs match Q0.

The first batch's outer360s timeout retained3 complete cases. Resume rechecks
all pinned inputs and independent per-engine values, preserves failed attempts
and names reused cases. Final Search receipt includes those3 reused cases.
Later all-case receipt revalidation executes0 new calls. Wrong-index resume
rejects without changing the original receipt/progress; unique outcome files.

No jobs. Source code and checkpoint are phase-pushed on owning work branches;
read live HEAD/upstream before continuing. Compiler implementation89c0c06324,
release implementation baseline549bd1a9044; later checkpoint commits preserve
exact tested bytes. Next: current Std and Resident, then integration and broader
acceptance. Persistent Store, maximum64-hit result pages, general local managed
return helpers, automatic install, external devices, all-cohort determinism and
public release are NOT completed here. Following sections are history only.

## Historical checkpoint: current-registry Search source and generated Core

Search0.5.0 now uses explicit index data, never a frozen historical catalog.
Current source count40/42; Std/Resident remain pending. Deterministic generation
covers40 implementations/153 WIT APIs/193 entries, preserving Android/iOS
implementations sharing one WIT identity. Four current package bindings include
2 native source packages, which are not Wasm artifacts or device qualification.
Read current-search-checkpoint.json. Q0,25 generated-Core tests (including193
exact lookups), and32 generation/cache/evidence checks PASS. An initial full-index
ordinary App test with duplicated literals reached240s; its failure is retained.
A string-returning local helper is rejected by the existing scalar-only local
call rule. Independent full-index/full-Root Apps are being replayed per case;
this separate compiler limit is retained, and Q2 is not yet claimed PASS.
No installation, full-cohort, integration or public release claim.

## Historical checkpoint: complete logical dual-engine Q2

JSON now passes all three APIs/nine cases for eight rounds on both Wasmi2 and
Wasmtime49.0.2 (72 calls/engine). Owned algorithms passes four APIs/six cases
for eight rounds (48 calls/engine). Evidence: dual-engine-q2-checkpoint.json.
Source implementation d4bc697f7971e3a06573e747b442f7a4e6d6e164 reuses the shared
logical decoder, bounds and deterministic cleanup; the scalar-only harness and
skipped-engine acceptance are removed. Ten independent evidence-checker tests
reject false completeness. The exact generated Libs and WIT are unchanged.
This is explicit-Root App Q2 with a fresh bounded Store per call, not persistent
Store soak, catalog resolution, public release or all39 qualification.
Registry remains39/42; Std, Search, Resident and prior device/integration gates
remain open. Next stage: current-registry Search, then current Std/Resident.

## Historical checkpoint: generic Unit-result fix and complete JSON Root replay

This supersedes the JSON-blocked checkpoint below. Read
unit-result-q2-checkpoint.json for exact source, artifact, oracle and receipt
hashes. The private compiler implementation is
a23204e0bfdb63d12c348dc545055c3ca7e58305 on
work/WS-20261007-unit-result-registration-v1; public compiler distribution and
Lib producer selection have not been replaced or relabeled.

The unchanged complete JSON Root now passes compact, invalid compact, select,
validate Unit success and validate error in ordinary WAsmC on Wasmi2.
Separate compact/select Apps also pass against that same full Root.
Full JSON receipt SHA256:
6697c41b6de33663fa10b2a9e8b62e62a573b600f974dcc35031c406ff9813ba.
Owned-algorithms control remains all4 APIs/6 cases PASS on Wasmi2/Wasmtime49.0.2.
JSON complex-return Wasmtime is not tested by the current maintainer API;
fresh bounded Stores are not a persistent Store soak. Wrong Root/bundle pins
reject. All52 affected compiler tests pass, including3 new regressions.

The only runtime-test oracle correction is invalid_json -> invalid-json,
independently confirmed from exact WIT. Original wrong-oracle failure remains
archived. Logical Unit is still payload-free; only its private storage slot
is padded, and codegen rejects mutated arm/field/role layouts.

Current inventory stays39/42; Std, current-registry Search and current Resident
remain pending. Next: integrate/revalidate the generic fix without bypassing
inherited active-tree/L1 metadata rejection, continue those three identities,
then complete full generated-Root Q2/device/determinism/release gates.
No main integration, all-Q2, new compiler/Lib release or compatibility claim.

## Historical verified checkpoint: historical identities and ordinary App Q2

2026-10-07T06:09:10Z. Read identity-closure-checkpoint.json, SHA256
0119ca312878b55169555b10cd7b6a73fd8548fb33d43b45e11767e792d9e0aa.
This supersedes older stage sections below. Registry: 39 current sources
(14 value, 4 resource, 1 explicit Host, 20 native); required identity union=42.
Std, Lib Search and MCPGit Resident are explicitly pending, not retired.
validate-lib-identity-coverage.mjs --require-complete rejects those omissions.
Legacy source tree and execution fallback remain absent.

New owned-algorithms 0.1.1, counter 0.0.2 and Host clock 0.0.2 use only current
WIT/delta/adapter sources. Three-library Q0 passes in 18118ms; identical-input
verified reuse is 1021ms, 3 hits/0 builds. Source-free Component SDK tests pass:
eight value cases, 128 counter rounds/257 drops, stale resource rejection,
missing Host import rejection and exactly two explicitly bound clock reads.

Ordinary owned-algorithms App Q2 passes all four APIs/six cases on Wasmi2 and
Wasmtime49.0.2 against the exact new Root/CoreLib. Wrong Root/bundle pins reject.
SDK receipt hash: 01b0ef292f5509f26ab00a2c7acb1162ceaee073f2f97147f03fc3622521733f.
Q2 receipt hash: faa396c3c0d1a3cdba2bc384d29c99853e436b04a73e062bff372213d9244fc4.
This is an explicit Root plan with fresh bounded Stores, not automatic catalog
resolution or persistent Store soak. The local runner uses exact maintainer
tooling without copying private compiler source into release output.

JSON remains blocked: complete and isolated compact/select probes all fail
'aggregate registration field type is unsupported'. Code points to Unit
rejection in aggregate_registration_field_role while the complete Root includes
result<unit,json-error>. Latest remote master also retains that restriction;
selected producer remains 15418b27ef. Do not prune validate from the Root or
promote Component tests into ordinary App PASS. Earlier result-unit .is_ok/
.is_err diagnostic also rejected; direct returns isolate type registration.

Next: separately owned generic Unit-result registration/ownership fix, then
exact JSON replay; complete current Std producer/current-registry search/current
Resident binding. No whole39 rebuild, foreign-device, full Q2/Q3 or release
admission is claimed. No jobs running at checkpoint; original compiler dirty
probes and all immutable releases remain untouched.


## Active stage: historical identity closure and generated-Root caller Q2

Activated 2026-10-07 after fresh YXSGIT task read. Baseline release source is
672b6e0a0d1b4313bc3c123edaeb94f3946b3456, branch/upstream identical and clean.
No staged, unstaged, untracked or intervening commits and no active writer.
Read current maintainer/refresh/Host/integrity Skills. Source gates pass; the
known immutable-product AGENTS.md drift is not a new-product admission.

Reconcile the six old-all18 identities absent from the 36-candidate registry.
Port standalone owned algorithms, counter and explicit Host clock into the
single current source format, without old package/build fallback. Keep Std,
search and resident implementation authority explicit; no fake replacement,
source disclosure or capability retirement inferred from their absence.
Then execute ordinary WAsmC source against exact generated Roots and record
caller/SDK scope separately. Preserve original compiler-worktree dirty probes.
Checkpoint each functional batch; public admission and main integration remain
false until their own required gates close.


## Current all-candidate checkpoint — 2026-10-06T20:08:21.186197+00:00

This is the current execution authority; older sections below are historical.
36/36 candidates now use libspec only: 13 value, 3 resource, 20 native.
The old libsrc tree (274 files), 26 old command entrypoints and 5 duplicate CI
workflows are physically deleted. All 22 real platform code copies were
byte-verified before deletion; tests/examples survive under tests/lib-refresh.
No backward-compatible authoring or hidden source/target-directory fallback.

Cold cohort refresh: 480585 ms. After deletion, normal locked
refresh verified/reused all 36 packages in 8662 ms (zero builds).
The current unified qualifier completed 19 suites, including original ten-Lib
oracles, Node Core, 13-Lib Wasmi, real TLS handshakes/negative controls, and a
source-free telemetry Component consumer with 128 resource lifecycles. Telemetry
27 native unit tests and real Linux proc acquisition pass. Linux endpoint,
socket, and operation-bridge tests pass against generated binaries and a current
same-run executor identity. Uinput real-device creation returns EACCES -13 under
this account: retain the failed witness, do not count it as hardware PASS.

Native status remains explicit: 3 locally compiled Linux binaries, 3 Node native
modules (real runtime tests also pass), 14 foreign-target source packages.
Source-package generation is not Android/iOS/macOS compile/device qualification.
Resource libraries emit only complete views actually supported; no fake ordinary
Core SDK. Full ordinary WAsmC API caller Q2, foreign devices, independent cold
cohort determinism, main integration and Q3/public release remain open.

Read all-candidate-checkpoint.json SHA256 70a62368a6f979746207a716e59321eadf15f582ba26acd08ff8fc5f59f37aa2
and legacy-retirement.json for exact roots, hashes, tests and nonclaims.
Successful final run: /home/huawei/code/.cache/wasmc-evidence/lib-refresh-all-candidates-20261006/runs/refresh-OIOZEL
Q1 evidence: /home/huawei/code/.cache/wasmc-evidence/lib-refresh-all-candidates-20261006/runs/refresh-OIOZEL/q1-attempt-KRUMx7
Q1/Wasmi/telemetry logs now use unique attempts; retries preserve earlier logs.


## Current resumption: finish all-candidate cutover

The human repeated the explicit no-compatibility instruction. Reconciliation
found HEAD/upstream still 46619598c715dbb4822cc6392d7320e0ba2dcc3c (0/0), but
264 changed/deleted/new paths from the interrupted all-candidate activation.
No staged changes or active writer were present. Those changes are preserved;
their exact hashes and tracked patch were saved under the external evidence
directory lib-refresh-v2-all-candidates-recovery before any further edits.

Live registry: 36 candidates, 16 Rust and 20 physical platform implementations.
The preceding partial runs already built Rust resource Components and packaged
native source/binaries, but have no complete all-candidate receipt. Current
execution: obtain that receipt, move remaining tests/resolver/CI onto generated
packages/current libspec, delete the old source tree and duplicate build paths,
then commit functional batches. Native source packaging, native compilation,
runtime tests and device qualification remain distinct facts. Do not fabricate
Wasm SDK views for a native implementation or discard working platform code.

Preflight rechecked exact hwlinux identity, Git history and dirty ownership,
47+ prior checkpoint inputs, current Skill, all-candidate inventory, no active
writer and 174 GiB free. Current 36-source validator and 11 workflow/cache tests
pass. This activation supersedes stale three/ten-library next actions below.

## Activation: all-candidate migration and legacy retirement (2026-10-06)

Human explicitly requests removal of all legacy authoring/compatibility paths.
Reconciled HEAD/upstream 46619598c715dbb4822cc6392d7320e0ba2dcc3c, clean,
0/0, exact hwlinux/huawei, no active writer. The live denominator is 36 source
directories, versus 28 entries in the incomplete old registry.

Convert remaining HTTP client/router/authorization/TLS/telemetry Rust sources.
Native C/Swift platform implementations move into the same libspec authority;
do not replace working hardware integration with unsupported stubs. Retire old
Cargo/candidate authoring and duplicate CI after moving behavioral test inputs.
Native packaging is not Wasm lowering or device qualification. Git history/tags
retain provenance; do not rewrite them or touch unrelated worktrees.

Preflight: current authority, Skill, inventory, source ownership, upstream and
disk checked. First action: extend generic complete-profile validation and
migrate remaining Rust candidates, then native build/test cutover. Checkpoint
each functional batch. Existing ten-library Q0/Q1 remains the baseline.

## Historical verified checkpoint: 2026-10-06T18:16:54Z

Ten-library migration, persistent cache and generated-Core Q1 are implemented
and verified. This supersedes older three-library progress below. Full evidence:
`ten-library-checkpoint.json`, SHA256
`ba52a76bc1356f963112328f8d7ec171f8354882b862607fe12d0a0f54ac41a0`.

The executor never falls back to libsrc. Stable Cargo workspaces/targets are
separate from immutable evidence runs. Sealed per-Lib inventory/hashes are
checked before reuse. Dependency WIT contributes types, not sibling Rust delta.
Per-package journals/stdout/stderr/exit status survive partial failure. A final
successful receipt exists only after every requested package verifies.
Eleven unit/integration cache tests pass; fixture-producer tests are not Lib Q1.

Actual runs under
`/home/huawei/code/.cache/wasmc-evidence/lib-refresh-v2-closure-20261006/runs/`:

- `refresh-DHJ0Ks`: first cold ten-library run, 421985ms / 10 builds.
- `refresh-X7GAsq`: same fingerprint, 2643ms / 10 verified hits.
- `refresh-4tWRCR`: final-generator cold run before fix, 421792ms / 10 builds.
- `refresh-ljQXO5`: real Data Core delta fix, 37605ms / 1 build + 9 hits.
- `refresh-14rjK3`: fixed-source repeat, 2696ms / 10 hits.
- `refresh-MbiI9W`: forced Data Core rebuild, 29919ms; entire regenerated Root
  matched its sealed file inventory, not only its Wasm digest.

Final ten-library fingerprint:
`0fd2af19a112a16c305f6e6c78e06e9107b29d5cc61947e6d033be1ed4cf3904`.
Producer commit `15418b27ef663dd4f456e2d46b077e2278c2c639`, binary SHA256
`d8d01bbb434a7bb002ab20f8e9353381c0aee07da43bbb7829853fd7e7c18306`.
Shared lock SHA256:
`92d22baf31ce6d7c1d518bdec31ff3cc17d559b1507799cc9aaf872dc146aee1`.

Q1 PASS: 50 cases / all 28 exported APIs / ten generated Core artifacts, Node
v24.19.0. Six Data + CSV contribute 37 cases/20 APIs; JSON/Compression/HTTP1
contribute 13 cases/8 APIs. Receipt `refresh-ljQXO5/q1-receipt.json`, SHA256
`82f4a58a1cabbd5a87ef37af6dae0e69fecca5fb5c9aa3cb6fa6daf2c9c12218`.
Tests include 10k integer profile input, IPC/Parquet round trips, null/64-bit
edges, grouping/windows and persistent Data Core error recovery/steady memory.

Real bug fixed: zero-column take returned invalid-layout because Arrow could
not infer rows from an empty array vector. RecordBatchOptions now carries the
selected row count. Zero-column selection, empty selection and zero rows pass.
Pre-fix failed Q1 receipts are retained.

Boundaries: Q1 is Node Core artifact behavior, not ordinary WAsmC -> CoreLib ->
DataLib Q2. It does not close the previous managed-graph 10k capacity question.
Resource/host/contract refresh profiles, all18, independent whole-cohort cold
determinism, Q2 and Q3 release remain open. Legacy libsrc/CI still exists as
migration evidence, not an execution fallback; retire both together after
redirecting oracle and engine tests. Do not overwrite immutable released bytes.
Full legacy maintainer integrity retains the proven base AGENTS.md mismatch.

Next: generated-Root Q2/oracle/CI, coordinated retirement of old ten-library
authoring, then remaining all18 profiles. No jobs running at checkpoint.
Original compiler-worktree HTTP1/Interchange WIP remains untouched.

## Current activation: ten-library closure (2026-10-06T17:47:57Z)

Human requested continued implementation with no legacy compatibility. Live
release worktree HEAD/upstream is 1010232452e02602d0c951609caeec4a377e77dc.
Six Data libraries, CSV, shared data-arrow and the generator/policy/lock changes
are owned workstream changes from the preceding session. Preserve and checkpoint
them before further edits. No other release changes or staged files were found.
The separate producer cache branch is clean and synced at
15418b27ef663dd4f456e2d46b077e2278c2c639. Original compiler HTTP1/Interchange WIP
is outside this workstream and must not be staged or reset.

Current evidence: nine-library cohort A has Q0 PASS, CSV has separate Q0 PASS,
and the new producer Data Core/Compute pair has Q0 PASS. Ten-library cohort B
has no complete receipt and no live process; it is interrupted/unqualified, not
running and not PASS. New Data/CSV Q1 and all Q2/Q3 remain open.

Preflight: exact hwlinux hostname/user/HEAD/branch/upstream, staged/unstaged/
untracked and recent commits checked; 175GiB free; no active writer. Read the
current release-lib-refresh-v2 Skill. YXSGIT task index still describes the old
JSON-only stage; revision-fenced checkpoint attempts encountered concurrent
main updates. This activation and current human instructions supersede that
older next-action text, not its historical evidence.

First executable action: checkpoint migration, then separate a persistent Cargo
workspace/cache from immutable evidence runs. Persist each package state and
logs, reject cache tampering, and prove no-change reuse and single-delta rebuild.
Add generated-artifact Data/CSV behavior tests before retiring old authoring
projects. No immutable released package is changed by this work.

## 0. Status

In progress, first value-profile cohort Q0/Q1 PASS, public admission=false, no candidate allocated, no immutable `libs/*` bytes changed.

Branch: `work/WS-20261006-lib-refresh-v2` from `origin/main@0d4f1f5085f134d8c9a3214d8e235c6ab08beed2`.

## 1. North Star

`libspec/` is the only future Lib authoring authority. A Lib author keeps only `lib.json`, `lib.wit`, `delta.rs`, and thin `adapter.rs`. Historical `libsrc/` Cargo/wit-bindgen projects are migration input only and will be deleted after migration rather than retained as a compatibility surface.

Business `delta.rs` uses ordinary Rust and ecosystem crates. It must not know about wit-bindgen, Core ABI, Wasmi/Wasmtime, Store/Linker, producer-private APIs, or generated package layout. `adapter.rs` only maps WIT-facing types/errors to delta and delegates.

## 2. Implemented mechanism

- Added maintainer Skill `release-lib-refresh-v2` and routed future Lib authoring to it.
- Updated release-integrity boundary: only private compiler/provider bytes remain non-rebuildable; public future Libs are intentionally rebuilt from V2 source.
- Added `libspec/registry.json`, shared `rust-policy.json`, and one cohort `Cargo.lock`.
- Added `scripts/lib-refresh-v2.mjs`: exact explicit producer, strict four-file inventory, generated Cargo workspace, offline/locked build, content fingerprint, automatic dual Root validation, refresh receipt and qualification plan.
- Added `scripts/validate-lib-refresh-v2-source.mjs` and wired it into `validate-maintainer.sh`.
- Added `scripts/test-lib-refresh-v2.mjs` for Q1 over generated import-free Core artifacts.
- Migrated JSON, Compression and HTTP1 to the four-file value profile without changing their WIT contracts.

## 3. Q0 evidence

Fixed-lock refresh was executed independently twice. Both runs produced the exact same fingerprint and exact same package hashes.

- fingerprint: `b1e1260daa0936b6cbe73f98c0aab7e67e11080a312fc6bde97e803676a1fae2`
- producer SHA256: `73b1885a9a5e5427755ee4565e8c05b231e03f032ba784d5e73c67088ee838da`
- shared Cargo.lock SHA256: `73abce6d00084ead6327c4ca7ee3241785ab0754bac9c29e65ddf36ddd9249da`
- `--update-lock` bootstrap was also re-run after deleting the lock; it regenerated the same lock digest and moved the run into a directory matching the final lock-bound fingerprint.

Generated hashes:

- JSON artifact `90f64aba...590ae`, component `678fe804...f4ef3`, core ABI `373ccf4f...c92e`.
- Compression artifact `20f5d353...1cae7`, component `aaa7236e...ef3a`, core ABI `9af2f0ab...b62b`.
- HTTP1 artifact `e2872d16...dd138`, component `8b1fd8c0...a1d6e`, core ABI `8a5482a1...65985`.

All three generated manifests carry canonical `rust_core` plus `rust_component`, `core-abi.json`, `component.wasm`, and generated SDK sources.

## 4. Q1 evidence

`scripts/test-lib-refresh-v2.mjs` consumes only the refresh receipt/generated Root. It does not build historical `libsrc` projects.

- JSON: compact, invalid validate, pointer selection, 65KiB+1 input rejection.
- Compression: compress/decompress round-trip, invalid stream, 1MiB+1 input rejection.
- HTTP1: parse, frame length, response serialization, invalid status, 64KiB+1 input rejection.
- all three Core artifacts are import-free and generated `lib.wit` is byte-identical to V2 source WIT.

Q1 receipt SHA256: `f81c0bf06b801903cc5f21c4a262bf37d8555d386592de5afec89d5b012630c6`.

Wasmtime CLI is not installed on this hwlinux environment; Q2 remains the explicit multi-engine ecosystem gate rather than being hidden inside Q1.

## 5. Dependency decision

The historical Compression project pinned flate2 1.1.2 but the crate payload is no longer available in the offline Cargo cache; the historical project itself cannot rebuild `--offline --locked`. V2 therefore does not preserve that stale engineering shell. Shared policy uses cached/current flate2 1.1.10 with rust_backend and one cohort lock. Dependency version changes are cohort decisions, not per-Lib edits.

## 6. Validation

Focused current commands:

- `node scripts/validate-lib-refresh-v2-source.mjs`
- `node --check scripts/lib-refresh-v2.mjs`
- `node --check scripts/test-lib-refresh-v2.mjs`
- two independent fixed-lock `--all` refreshes
- `node scripts/test-lib-refresh-v2.mjs --run-root <Q0 run root>`
- `git diff --check`

The full maintainer validator still inherits a pre-existing fresh-main integrity mismatch for `AGENTS.md`; this existed before this workstream and is not repaired here because no candidate is allocated and immutable prior release identity must not be rewritten.

## 7. Next

Next implementation slice is the six Data Libs. The key architectural task is to extract a single shared Arrow/Data adapter so BatchSnapshot/WIT <-> Arrow conversion lives once, while each Lib delta contains only its algorithm. After Data: resource profile, then host/contract profile, then all18 Q2 and release Q3.

## 8. Do not do

- Do not add a second supported authoring format.
- Do not special-case package names in compiler/producer.
- Do not move business logic back into adapters.
- Do not restore per-Lib Cargo.lock or dependency versions.
- Do not rewrite existing admitted/released `libs/*` bytes in place.

### Baseline maintainer-integrity note

Full `validate-maintainer.sh` runs the new V2 source validator first and that
step passes. The next legacy release-integrity step fails on
`manifest identity mismatch: AGENTS.md`. This is proven pre-existing at the
workstream base `0d4f1f5085f134d8c9a3214d8e235c6ab08beed2`: base AGENTS.md is
17381 bytes / SHA256
`0be5c159ac964a3ab914e64cdd62d0c6d20ef4c2f6568b17c7b4ea57defbd56b`,
while base manifest.json expects 16487 bytes /
`7d5e0d871bc5d9b9f4f8587929cf9f84c08a13d3874644c1be9e9747ef8350f0`.
No release-integrity metadata is refreshed in this pre-candidate workstream.
