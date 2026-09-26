# WAsmC release maintainer handoff

## 2026-09-27 Lib ecosystem control-plane implementation

The first ecosystem convergence slice is implemented. The deterministic
`scripts/lib-ecosystem-control-plane.mjs` follows `release.json` to its exact
staged product manifest, verifies each package's immutable product bytes, reads
the executable LibSearch snapshot and resolver/install catalog, inspects actual
Core imports, and emits `lib-ecosystem-control-plane.json`.

The generated result makes the current mismatch explicit: 13 packages are
qualified, admitted and released; only 5 are discoverable and 4 installable.
The output also records artifact-bound engine evidence when present, refuses to
infer minimum versions, preserves telemetry's surface restrictions, and gives
per-package stopping conditions. Its check is wired into the integrity CI
family and public Library-first guidance now reads it before search.

An initial implementation incorrectly treated `release.json.artifacts` as the
complete product set and therefore called eight released packages unreleased.
The corrected generator follows the declared `staged_product_manifest` and
validates package rows against that product set while allowing later mutable
guidance files to differ from immutable v0.0.13. This is the exact authority
distinction the control plane is intended to enforce.

The isolated Lib discovery completeness remediation is now consumed. The new
`catalog/libs-v013.json` is generated from the exact 13-package product set and
reviewed discovery intent; exact resolve and no-clobber mocked install tests
pass for the successor catalog while retained v0.0.9 locks remain valid. The
control plane now distinguishes immutable-tag installability (4) from the
current-side successor catalog (13), so the remediation is usable without
pretending it was retroactively shipped in v0.0.13.

The focused pre-candidate validator was adapted to preserve the exact current
main-side release/manifest/provenance identities at invocation rather than
hard-coding their pre-flywheel hashes. Immutable candidate, prod, package-index
and v0.0.9 catalog anchors remain hard-bound, and the old candidate still
rejects the future catalog as product drift.

LibSearch 0.2.0 has now been rebuilt from private producer commit
`03e093452fbc18c082df371627c15f439195ccb6` against the exact 13-package
`catalog/libs-v013.json`. The resulting candidate indexes 14 package identities
including itself / 122 entries. Current-toolchain independent builds are byte
identical: Core 53,412 bytes at
`f525deed55a3a942d63c6780b18ac7dc5e496dcf4ce47baaa2da0cbf1795afb1`;
Component 55,178 bytes at
`db0e7838424522e23a4f6d0e84759ca6fb631cb3ace516ac6ce514ec39bf831d`.
Node Core/reference comparison (609 cases and 11,000 resident calls), Wasmtime
47 Component invocation and Wasmi 2.0 Core execution pass. Exact candidate
evidence is `admission/lib-search-v020-v013-candidate.json`; the unified control
plane records it as qualified but not admitted/released/discoverable/installable.

The historical producer receipt did not byte-reproduce under Rust 1.96.0 even
though the producer commit, index and Cargo.lock were exact. This proves the
existing receipt only established within-environment determinism; Rust codegen
toolchain identity is still missing from the hermetic build contract. Preserve
both identities and treat toolchain pinning as the next release-infrastructure
repair, not as permission to overwrite historical evidence.

Next convergence slice: add an executable toolchain-fingerprint gate to
Rust-backed Lib build receipts/packages, then regenerate this candidate under
that explicit contract. Do not rewrite v0.0.13, relabel LibSearch 0.1.0, or
admit 0.2.0 without future-candidate review authority.

## 2026-09-27 Producer u64 to release authority delta

WAsmC producer `master` now contains exact ordinary-source `u64` semantics at
`94328ed760f93bf24b595a71facdcc773d43b762`. Strict MST, five focused u64
semantic tests, Component full-range round trip, the 9-row/8-limit capability
matrix, check-fast and remote 0/0 readback passed on the containing commit.

This does **not** alter immutable wasmcrelease v0.0.13 or any compiler/Runtime/
SDK/Host/Lib bytes. The release states for this new producer capability remain
qualified=false, admitted=false, released=false, discoverable=false and
installable=false until a new exact source-free compiler candidate is built and
admitted. `release-surfaces.json.producer_capability_delta` and the compact
`agent-quickstart.json#producer-release-u64-delta` route encode that boundary.
`u32` was already released and needed no repair; `char` remains unimplemented
on the cited producer commit and arbitrary `u32` is not a valid substitute.

The focused pair is now accepted on exact guidance commit
`507b962c02c801d8a691a985f9e8da7f9ea9f597`. Pi 0.87.1 used both
`llm-m4dd/deepseek-v4.1-flash` and `llm-m4dd/glm-5.3-flash`; both answers led
with producer yes / immutable release no, preserved the exact producer commit,
reported all five release states as false, kept u32 and char distinct, generated
no source, and used one or two tool calls with two assistant turns and zero
errors, retries, duplicate calls or repeated reads. The durable privacy-safe
receipt is `agent-evaluation/receipts/pi-producer-release-u64-delta-507b962.json`.

White-box iteration mattered: one initial DeepSeek heading was authority
ambiguous, while two correct GLM answers exposed newline and phrase-coverage
gaps in the evaluator. Guidance now requires an explicit opening authority
split, and the evaluator normalizes whitespace plus accepts equivalent explicit
release negatives without weakening identity or five-state checks. This is a
focused pair probe, not a replacement for the frozen six-case qualification.

## 2026-09-26 Live-Agent learning flywheel side-remediation

This workstream improves public release comprehension and evaluation only. It
does not change WAsmC compiler, Runtime, SDK, Host, Lib or product bytes; it
does not advance `v0.0.13`, admit a candidate, or take authority from the
active Data Foundation v1.1 producer work.

The north star is now explicit and intentionally small: a fresh Pi Agent must
accurately and efficiently learn WAsmC from a pinned public release with either
`llm-m4dd/deepseek-v4.1-flash` or `llm-m4dd/glm-5.3-flash`, with zero private or
prior-session context. `agent-evaluation/fresh-agent-learning-v1.json` freezes
six decision/execution cases. Controlled-pair qualification requires both model
routes to pass every case on the first final answer, on the same Pi version and
release commit, within bounded trace structure. Wall-clock time remains an
observation rather than a standalone gate. Route labels bind local observed
configuration; they do not independently attest the upstream implementation.

Existing individual Pi and OpenCode receipts are seed observations. OpenCode is
no longer part of the qualification matrix, and a single Pi model PASS must not
be described as controlled-pair qualification. The evaluator rejects a missing
partner model, any case error, and retry-driven passes.

### First controlled-pair baseline and remediation

The first frozen six-case baseline used Pi 0.87.1 at guidance commit
`fe85689de36a67aa8fed84771e7649275ba86614`. Raw traces and hidden reasoning
were not retained. DeepSeek Flash 4.1 was semantically correct on all six cases
but met the strict structural gate only for release-state separation. GLM 5.3
Flash met it for the capability-negative and Host-authority cases; its
Library-first case produced no final answer and was terminated after more than
240 seconds. Both models shortened an unnecessary digest in release orientation;
DeepSeek also over-read and shortened identities in the Base64 journey. Exact
privacy-safe metrics and classifications are retained in
`agent-evaluation/receipts/pi-two-model-baseline-fe85689.json`.

This is primarily a release-guidance gap: existing exact status-query records
produced the shortest successful paths, while orientation, canonical aggregate
execution, Base64 and Host authority lacked equivalent single-hop routes.
`release-surfaces.json.agent_task_routes` now provides those four bounded,
full-identity records and explicitly stops unrelated history, compatibility and
implementation exploration. The Base64 resolve command reproduces lock digest
`63806ae6ee83164fd955753091cbfe74dac689d29c29a5371eadfc07b0ca1953` and the
standard behavior oracle still passes 5,120 dual-consumer calls. This changes
guidance only, not product bytes. Rerun both models from fresh sessions on the
new exact commit before claiming improvement or controlled-pair qualification.

An intermediate DeepSeek probe on `dba4444` confirmed the route concept but did
not close the pair: release orientation fell from 16 tools/9 turns/93,641 ms to
8 tools/6 turns/17,170 ms, while Base64 still expanded into an invented source
probe and hit the 180-second cost stop. Exact evidence is
`agent-evaluation/receipts/pi-deepseek-probe-dba4444.json`. The next refinement
adds one compact `agent-quickstart.json`, a deterministic 49-byte aggregate
example runner, a direct `abc -> YWJj -> abc` Base64 runner, the exact
`WebAssembly.instantiate(Module)` usage, a negated-range evaluator fix, and a
reproducible Pi runner using local Git clones plus a hard per-case timeout.
These are guidance/evaluator/harness changes; no compiler, Runtime, SDK, Host or
Lib product byte changes are claimed.

The first full dual-model run on `bdc75bc` materially improved structural
efficiency: DeepSeek passed all six structural gates; GLM passed five, with no
timeout. The pair is still not accepted. White-box review rejected two DeepSeek
answers (missing `installable` in the direct telemetry five-state table and an
incorrectly conservative Base64 installability statement) and two GLM answers
(historical-catalog exploration in the capability-negative case, and treating
the retained v0.0.9 resolver snapshot as current release authority). Exact
metrics are in `agent-evaluation/receipts/pi-two-model-round-bdc75bc.json`.

The next bounded correction makes quickstart precedence exclusive when a route
matches, requires all five telemetry output states, records Base64 installability
as true, and distinguishes current product release v0.0.13 from the resolver's
retained v0.0.9 delivery index. Rerun the full pair on one exact successor
commit; do not qualify from the `bdc75bc` observations.

That rerun is now complete on exact guidance commit
`bb9615a00d6a8c443b2612b4b23ded3a00f1e2c7`. Pi 0.87.1 with both
`llm-m4dd/deepseek-v4.1-flash` and `llm-m4dd/glm-5.3-flash` passed all six
frozen cases without timeout, structural retry/error/duplicate-read failures,
or white-box semantic failures. Review covered exact identities, independent
type-position decisions, real 49-byte import-free execution, complete five-state
reporting, Base64 installability and snapshot identity, and exact Host allowlist
behavior. The controlled pair is accepted by
`agent-evaluation/receipts/pi-two-model-qualified-bb9615a.json`. Raw traces and
hidden reasoning were not retained; the receipt preserves metrics and final
answer digests. This qualification changes guidance and evaluation artifacts
only, not compiler, Runtime, SDK, Host or Lib product bytes.

Protocol validation, its synthetic positive/negative cohort tests, the release
surface validator, the maintainer validator and the deterministic Fresh-Agent
regression pass. The integrity-suite entry for the Pi two-model contract also
passes. The overall integrity suite still rejects
`channels/candidates/0.0.13.json` because this branch's existing main-side
guidance differs from that immutable candidate's historical `AGENTS.md` and
`release-surfaces.json`; do not rewrite the immutable candidate to make this
side-remediation green. A future formal release must bind the protocol and
current guidance into a new exact product identity.

A fresh Pi journey against the Data Foundation candidate produced a correct
high-level answer but needed 22 tool calls and 13 assistant turns in about 102
seconds. It consumed 31,051 input, 2,420 output and 705 reasoning tokens, with
269,504 cache-read tokens. There were no tool errors, exact duplicate calls or
explicit retries, but the route still performed avoidable navigation and read
a complete roughly 49 KiB release manifest. The final answer abbreviated an
artifact digest, generalized exact Node evidence to `Node 22+`, and invented a
future package directory. This shows why explicit retry count alone is not an
adequate Agent-efficiency metric.

The release guidance now separates `qualified`, `admitted`, `released`,
`discoverable` and `installable`, defines a bounded lookup order, and forbids
ellipsis identities and inferred engine ranges in executable guidance. The Pi
JSONL adapter records only the privacy-safe event surface and separately scores
tool/turn/result budgets, errors, zero-yield lookups, explicit retries,
duplicates, repeated reads, final-answer presence and identity/version hygiene.
Deterministic Fresh-Agent evidence remains distinct from live-model evidence.

The same `llm-m4dd/glm-5.3-flash` status prompt was then rerun after adding two
machine-readable negative status records to
`release-surfaces.json.agent_status_queries`. It passed the `status-query`
profile with four tool calls, three assistant turns, zero zero-yield results,
zero errors/retries/duplicates/repeated reads and 9,573 result characters in
15,870 ms. Tokens were 5,984 input, 785 output, 115 reasoning and 7,104 cache
read. The final answer kept the requested direct surfaces separate from the
related released telemetry product, used the complete package identity, and
did not infer a version range. This is one live-model observation, not a
deterministic cross-model guarantee.

Producer feedback is research-only: machine-readable WIT binding support for
rich resource results, artifact-bound engine requirements, generated manifests
separating WIT/Core/Component/Host, stopping-condition diagnostics, and exact
candidate-to-admission-to-release receipts. None of these capabilities is
claimed implemented. Continue to use release prose for honest stopping
conditions until producer-owned evidence exists.

### Pi and OpenCode retrospective follow-up

A read-only hard-limit exercise mixed traits/open generics/async, `for`/ranges,
Rust-style match destructuring, direct telemetry sampling, a public Map return,
and a prebuilt macOS dylib. Pi and explicitly selected
`opencode-go/deepseek-v4.1-flash` both recognized the obvious syntax and release
stops, but both initially overgeneralized resident Map support into public Map
return support. OpenCode also proposed mirroring the telemetry frame as an
ordinary record without first reconciling its `u64` fields with the public
ordinary-source scalar set. A targeted self-audit retracted both claims after
finding the explicit public-Map rejection and the executed `u64`/rich-result
negative evidence. This confirms that retrospective text is a hypothesis
source, not an authority or automatic change request.

The public guides now state those two already-evidenced boundaries adjacent to
their first-use concepts. The trace evaluator also no longer reports the
literal phrase `never infer Node 22+` as a positive range claim. OpenCode
1.18.15 currently lists `opencode-go/deepseek-v4.1-flash`, but the local default
remains `openai/gpt-5.4-mini`; availability is not default-router selection.
Requesting the `plan` subagent through `opencode run` fell back to the default
primary Sisyphus Agent, so future read-only OpenCode harnesses must verify the
effective Agent/permissions rather than trusting the requested subagent name.

The direct OpenCode CLI exercise above is not Pi evidence. A follow-up added
the already service-visible `deepseek-v4.1-flash` identity to Pi's local
`llm-m4dd` model catalog and verified the effective response metadata as
provider `llm-m4dd`, model `deepseek-v4.1-flash`. The standard status query
passed through Pi with seven tool calls, six assistant turns, 23,766 result
characters, zero errors/retries/duplicates/repeated reads/zero-yield results,
and 14,445 ms elapsed. It reported complete telemetry artifact digests.

The composite hard-limit/retrospective query used 23 tool calls, 12 turns,
109,412 result characters and 43,949 ms. It correctly separated resident Map
from public Map return, rejected ordinary-source `u64`, and observed all other
requested stops, but still abbreviated three artifact digests. Its own
retrospective did not identify that concrete final-answer error. A separate
range-hygiene signal also fired on a quoted bad example, showing that lexical
hygiene checks still need evidence-aware context. Treat self-report and lexical
scoring as complementary signals, never sole admission gates.

### Position-aware capability projection

Private producer workstream `WS-20260926-agent-capability-matrix-v1` checkpoint
`138d542c` now records implementation truth by type/feature, source or boundary
position, execution profile and release projection. This release workstream
does not import its private experimental admissions. Instead,
`release-surfaces.json.agent_capability_projection` resolves only public
v0.0.13 behavior: ten ordinary-source scalars excluding `u64`, one semantic
result with tuple/record logical aggregation, resident/local Map versus public
snapshot/resource, scalar-only synchronous Host functions, exact rich-resource
profiles, and the hard generics/async/authority/memory/retry boundaries.

The projection is explicitly current-main side-remediation: it changes no
product bytes and is not retroactively present inside immutable tag v0.0.13.
The next formal release must package and validate this projection or a
schema-compatible generated successor.

Pi 0.87.1 on `llm-m4dd/deepseek-v4.1-flash` read this projection in two tool
calls and three assistant turns: 13,246 result characters, zero errors,
retries, duplicate calls, repeated reads or zero-yield results; elapsed model
time 3,124 ms. The status-query evaluator accepted it. The final answer rejected
ordinary-source `u64`, public `map<string,u64>` result and async independently,
did not generate source, preserved numeric/identity/async semantics, and
reported the main-guidance/non-tag scope. A positive record-result probe also
compiled through public v0.0.13 to a 49-byte import-free Core module with
`run(5,1)=[6,1]`.
## 2026-09-26 Lib discovery completeness — STARTED

Own branch: work/WS-20260926-lib-discovery-completeness-v1, based on exact
v0.0.13 prod b1d22d27bdc9727e607cf77a4af57b151df6832d.

Observed defect is release/discovery drift, not a search-kernel limitation:
v0.0.13 contains thirteen public Lib package roots, but the shipped resolver
catalog remains the four-package v0.0.9 snapshot and LibSearch 0.1.0 remains a
five-package / 89-entry snapshot. telemetry, csv, relational and parquet queries
therefore miss released capabilities.

The prior work/lib-discovery-v013@c2f2dea6 remediation proved the direction on
v0.0.12, including LibSearch 0.2.0 and package-intent-v1, but was never merged
or promoted. Its binary/index receipts are stale for v0.0.13 and are not reused.

Current remediation derives the package-root inventory from the exact frozen
0.0.13 product candidate and requires explicit reviewed discovery intent for
every root. Missing or extra intent fails closed. The generated v0.0.13 catalog
contains all thirteen roots while the old v0.0.9 catalog remains byte-identical.
The next gate is rebuilding LibSearch 0.2.0 against this exact catalog and then
running fresh Core/Component/Wasmi and search-completeness evidence. Do not move
or republish v0.0.13 tags.

Important identity checkpoint: the first mechanical
`scripts/refresh-integrity.mjs` run was deliberately rejected as the branch
authority because it rewrote v0.0.13 `release.json` / `manifest.json` /
`provenance.json` to inventory future workstream bytes. The old 0.0.13
candidate correctly rejects this changed tree as product drift. Those generated
identity changes were reverted. Until a future additive product candidate is
explicitly frozen, this branch uses focused discovery validation and preserves
all v0.0.13 release identity files unchanged.

The pre-candidate gate is
`node scripts/validate-lib-discovery-workstream.mjs`. It hard-binds the old
release/candidate/prod/v0.0.9 catalog identities, runs v0.0.13 discovery
completeness plus catalog/install regressions, and requires the immutable
v0.0.13 candidate verifier to fail specifically with `product drift rejected`.
Do not wire this future-version workstream into the old release's official
validator/CI family before a new candidate identity is intentionally created.
## 2026-09-25 Host SDK integration and candidate reopen hardening

Exact local source qualification is now complete for
`6415ad6f3231c6b97fe87e351d38315a1b488124`, with clean source before and after
the isolated consumer rerun. See
`admission/system-telemetry-v1/host-integration-local.json` and its retained
`host-integration-local.log`. Ten tests pass (zero failed/ignored); the live
128-frame run made 47 snapshot reads through 94 generic read calls, and four
explicit file grants closed (FD9->5). Twelve actual candidate reopen rejection
tests also passed. All consumer/SDK/driver input digests and unchanged monitor
artifact digests are recorded. This metadata checkpoint does not change the
tested executable sources or the candidate products. The extended six-cell
workflow still needs its own exact-commit results; do not reuse the older
three-cell PASS as qualification for this new consumer.

The exact prior candidate `8d605fab00dbc243db5d97f7aaf6aabf4ecfab9a`
completed Actions run 36147323962: all three Wasmtime49 source-free Component
jobs passed (Ubuntu, Windows, macOS). Linux additionally passed real proc
acquisition. This is not all-platform system collection or Wasmi evidence.
The job/step receipt is `admission/system-telemetry-v1/component-ci-20260925.json`.

The next bounded slice adds a source-free consumer of the existing public
`wasmc-host` SDK plus the same telemetry Component. It uses only explicit
read-only file grants and generic open/read/release. No SDK, compiler, CoreLib,
Host ABI or telemetry product bytes are changed. Snapshot reads are complete
and bounded, with one-byte EOF probing at capacity, invalid completion length
rejection, and retained handles for explicit release.

Local revision evidence before checkpoint: ten Host/Component tests passed,
including real SDK handling of short reads, unauthorized selectors, stale
handles, truncation, malicious read lengths, and transactional parse errors.
The real Linux SDK/Component loop passed 128 frames and closed exactly four
grants (FD9->5). This uses Wasmtime47 matching the public SDK; it is not a
Wasmi execution or benchmark result. Use `scripts/test-telemetry-host.sh`.

`scripts/test-telemetry-package.mjs` now invokes a reusable strict candidate
verifier with an independent expected manifest/product identity. Twelve actual
modified package copies reject, rather than only comparing a changed hash.
Existing candidate bytes, candidate `approved=false`, main and v0.0.12 remain
unchanged. Do not silently upgrade historical receipts or package metadata.

Next: verify this new exact source's extended six-cell CI; finish the producer-
owned mixed resource/value binding needed for ordinary WAsmC sampler methods.
The public `compileLib(source, explicitPlan)` entry is not proof a matching
plan exists for this new WIT resource. Never bypass it with public raw handles
or a telemetry Host callback. Production schema/catalog/search, exact engine
scope, private-producer admission and immutable promotion remain separate.

## 2026-09-25 Telemetry release candidate — NOT prod

The user requested formal monitoring Lib publication. Work is isolated on
`work/system-telemetry-release-v1` from exact v0.0.12 source
`735cc7fea762ba76f96d443cf64e47a31f8a1cc6`. The original monitoring experiment
`8522ccd20498dc369c3aaf5e2bb604a55cf89c17` remains immutable history, not a
ready-to-release Lib. No compiler, CoreLib, Host contract or prod pointer changed.

The new public-source candidate is `libsrc/wasmc-system-telemetry`. It accepts
explicit complete Linux-format snapshots and caller timestamps, with bounded
parsing, refresh policy and transactional state. A source-free Rust Component
caller executes the WIT resource API. The live Linux example preopens four
read-only resources; it is not the published generic Host SDK binding.

Local evidence: 27 native unit tests, 3 complete-read tests, 100 live frames
with FD count 4->4, and 128 source-free Wasmtime49 Component rounds passed.
The first caller build required matching panic=abort warm dependencies. This
does not count as a clean Cargo or cross-platform qualification. Historical
performance, zero-allocation transport and ring-loss claims are not inherited.

CPU first/reset/no-progress is now absent, not measured zero; frame v3 flags
bit0 records that distinction. Do not silently call this the old frame-v2 ABI.
Raw Core contains Canonical resource-new/drop imports, not telemetry Host APIs.

Next: finish real WAsmC resource-method consumption using the published generic
mechanism, generic Host acquisition integration, exact source-free multi-engine
and multi-platform CI, official Lib/discovery validation, and immutable
dev->main->prod promotion. Until then keep `admitted=false`; do not add a prod
Lib entry, move v0.0.12, or claim the user-requested formal release is complete.

### Candidate publication checkpoint

Producer source authority is `c11ccf013cb23a7659cf5ae7a1ba916a60770dda`.
`admission/system-telemetry-v1` retains the complete candidate and local
qualification receipt. Core: 41,850 bytes, digest
`581d6d58c83db4484cb80b5a8492e62125e70600e57b2e26651717dfdd6cdaa1`.
Component: 44,838 bytes, digest
`1bdbb092414e9e12e0e86a1d10f24490ce10fc37c3656a2653e4e22e20d6d08e`.
Two separate Cargo target builds produced identical bytes. The existing
maintainer/integrity gate and candidate registry/identity checks passed locally;
they do not admit this new Lib. Main and immutable v0.0.12 remain unchanged.

GitHub integration `create_pull_request` returned 403 Resource not accessible
by integration; no PR was created. The candidate branch is writable via the
authorized Git remote. The same read-only qualification workflow is enabled on
this exact candidate branch's pushes, without changing any test or prod gate.
Check its actual results; configured CI is not a PASS. The public compiler does
expose `wasmc_compile_lib` and `wasmc_plan_alloc`; this is a possible existing
integration entry, not proof this new sampler world already compiles/executes.

## 2026-09-20 Data Foundation v1 admission and release

Release state: prod promotion prepared from accepted exact-tag receipts.
Immutable dev is `v0.0.11-dev.1` at
`532c0e413104786a46e3b9cf0ebafb16de55626a`; immutable main is
`v0.0.11-main.1` at `da06f944f161888fa5efd989193623f8d71e6e04`.
The suffix-free `v0.0.11` tag must peel to this handoff's final prod commit,
and remote readback must preserve product set
`101a8a3783d52fc3d06e15731b20ec5fbe5a2bdbd7d9e964876f76ce44e33662`.

Seven Data Foundation Libs are admitted as immutable source-free `0.0.1`
packages: Data Core, CSV, Expr, Compute, Relational, Data Profile and Data
Interchange. Their exact implementation authority is
`ff6928b09194b4818b05117ec0ba6a71b998d224`; every Core artifact has zero
imports and each package contains only `SKILL.md`, `lib.wit`, `lib.json`,
`artifact.wasm`, `component.wasm` and `references/agent-delta.json`.
Human admission was explicitly approved on 2026-09-20. The product release
target is `v0.0.11`, using immutable dev → main → prod promotion without
moving any existing tag. Host ABI/lifecycle/no-replay remains frozen.

The admitted v1 boundary includes deterministic group aggregate, union-all,
bounded typed inner/left equi-join, deterministic ranking window,
first/last, population variance/stddev, Data Profile, Arrow IPC file and
uncompressed Parquet. Lag/lead, frame aggregates and distinct remain v1.1.
SQL/DB remains deprioritized. Run `scripts/review-data-admission.mjs`,
`scripts/validate-libs.mjs`, the Data Foundation workflow and the official
maintainer validator before promotion.

## 0. Status

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

The immutable Data Foundation product candidate is
`channels/candidates/0.0.11.json` with product set
`101a8a3783d52fc3d06e15731b20ec5fbe5a2bdbd7d9e964876f76ce44e33662`.
All dev/main/prod promotion stages must preserve that digest set exactly.

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
in host/drivers/tcp/linux-frame-regression.json. Removed readable experiment failed Deno.
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
frozen SDK remain unchanged. Verify channels/candidates/0.0.11.json frozen
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
old epoch tickets remain invalid. See host/runtime/completion/LIFETIME.md; this is not
general async recovery/guest ABI or long-run RSS/network qualification.
Mac ARM Bun Kernel CI empty sync-spawn stdout is corrected with event-driven
spawn/pipe-drain/close, no replay. Changed source requires own qualification.

Bounded Core describe now exposes profile version/copy feature/limits without
new Host imports. Negotiated guest performs preflight before allocation/invoke.
Local six JS/Native engine pairs pass four lengths and seven denial cases;
Native denies with zero non-describe calls/resources/effects. Typed WIT SDK and
arbitrary-device description are not implied. Owning host/contract/v0/NEGOTIATION.md.

## 4. Plan and Validation

Read release-host-integration, release-integrity and release-agent-docs Skills.
Run scripts/maintainer-orient.sh. Develop and verify locally, batch milestones;
queued Actions does not block development or permit unqualified promotion.

Build: cargo build --release --locked --features wasmtime-engine
--manifest-path host/tests/e2e/rust/Cargo.toml. Use one shell command line.
Owning runnable commands and limits:
- host/drivers/tcp/ENGINE_PROFILES.md: identical resident App/Lib on both Native engines.
- host/drivers/tcp/BENCHMARK.md: checksummed pure compute; not network/durable TPS.
- host/drivers/tcp/READ_STOP.md and WRITE_OUTCOMES.md: issued-I/O/partial-effect fences.
- host/drivers/tcp/STOP_FAILURE.md and SUPERVISOR.md: retained ownership and bounded quota.
- host/embedding/browser/README.md: actual Chrome/Firefox/WebKit probes, not phone emulation.

Before commit: refresh-integrity.mjs, validate-maintainer.sh, actionlint,
git diff --check; stage only own changes and verify remote recovery.
Host Actions now requires six Native desktop plus three browser cells, both
engine correctness paths and benchmark checks. Read actual per-case receipts.
Cancel obsolete known-defective own runs only; never weaken required gates.

## 5. Current Action

Full Host delivery denominator is five gates from host/contract/v0/README.md, not
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
