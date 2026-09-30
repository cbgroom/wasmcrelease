# WAsmC release maintainer handoff

## 2026-09-30 current-v2 development closure (unreleased)

This section supersedes the historical candidate status below for the current
development workstream. Public prod remains immutable v0.0.20. Current Lib
selection is separately bound to `catalog/current-v2-policy.json`: five v2
packages, thirteen excluded pending migration gates. Producer protocol authority
is 3b797a77d0afa25264a11362603b0d596d2e0ba7; package authority is
4c25aafc02b8eaa1ba1c1ba85c5697e58e8d19a1. Neither implies a new release.

PR #23 (`work/WS-20260930-lib-v2-ci-closure`) repairs API-level discovery,
current-vs-frozen CI routing, Node 18 teaching compatibility, and fresh install
reopen/no-clobber/tamper controls. The current consumer route is
`agent-current-lib-quickstart.json`; old `agent-quickstart.json` describes the
immutable v0.0.20 product, not current-v2 selection. CLI now has `--help`.

Focused suite: 12/12 local PASS, including fresh-installed Std Core Base64
behavior (six calls, nine buffers dropped). Five packages downloaded from
their exact GitHub authority and reopened PASS. Node 18 development preflight
PASS; Std behavior remains artifact/engine-specific. Ordinary App consumption,
the thirteen migrations, and a new release are not closed.

Pi discovery observations are diagnostic, not release pair qualification.
The first round at 5d080ee exposed mixed quickstart routing, unsupported CLI
help, excess ABI/engine investigation, and an underspecified evaluator field.
Retain both failures; revised typed observation protocol is v2, not a rewrite
of the frozen full release cohort. Live trace accounting now records child
commands reporting failure even when a shell pipeline exits successfully.

Round3 at a355b3aabc26154442bb57c8de763ba57d1f4460 passes the same one
discovery task on both Pi 0.87.1 model routes with nine tools each, no errors
or retries. Independent white-box review is retained in the workstream receipt;
full frozen release cohort qualification is still false. Current search also
checks every selected WIT export: five package routes / 91 API routes, with
missing and extra routes rejected. This is development closure only.

Resume from `.agents/workstreams/WS-20260930-lib-v2-ci-closure/HANDOFF.md`.
The all-package closure slice now stages five additional v2 roots with complete
second-build equality and strict reopen: HTTP1, Host Clock, Owned Algorithms,
Resource Counter and Data Core. Exact-artifact behavior and five generated SDK
consumers pass locally; source recovery for the three historical fixtures is
complete. Protocol build progress is 10/18; selectable catalog remains 5/18.
Read `admission/current-v2-next/qualification.json` and the branch handoff for
scope-specific evidence and the remaining eight rebuild blockers. This batch
has not been admitted to current discovery or a new immutable release.
The new Wasmi empty-batch probe exposed a Data Core defect reproduced on
Wasmtime: `validate` accepts zero columns, but `take` lost explicit row count
and returned invalid-layout. The public adapter now preserves selected-index
length in Arrow RecordBatchOptions; three native regressions PASS. Data Core
has now been rebuilt twice from 3270e4c3d504e12a899464f115542a8efc578b06;
strict reopen, ten Component cases, 128 Wasmi rounds and 896 generated-SDK
calls PASS. Current staging carries only those repaired bytes. Catalog and
release admission still remain; the original failure is separately retained.
Preserve the other workstream's uncommitted WIT dependency implementation.
The next checkpoint adds exact Wasmi execution for all three recovered fixture
roots: Owned Algorithms (1024 calls), Clock (256 calls plus missing/wrong Host
binding rejection), and Counter (128 explicit-destructor lifecycles with a
balanced embedding resource table). Counter's imported drop callback has not
been executed in this Core probe; full canonical drop remains covered only by
the generated Component SDK journey. Do not conflate those scopes.
HTTP1 and Data Core primary-upstream review now binds seven exact registry
archives to Cargo.lock, compares their Rust source bytes to official pinned
Git commits, and retains fifteen upstream license/notice files. In particular,
arrow-array 60.0.0 is Apache-2.0 AND MIT, unlike the other five Arrow crates.
The offline gate rejects altered provenance, missing notices, file/directory
links and false promotion claims. Full transitive license audit, explicit
package license binding and ordinary App admission remain pending. No new
package has been selected or released by this evidence-only checkpoint.
The next local checkpoint closes source-free SDK consumption for the five
staged roots: a fresh isolated 48-file tree contains only their exact generated
roots and the public consumer, with no compiler/provider/upstream semantic
implementation source. Locked/offline compilation and all five SDK executions
PASS. Public engine Cargo dependencies remain the admitted consumer toolchain.
The repeated optional Intel HTTPS CI failure remains retained, not waived:
9f498ab run 36774756671/job 110089765924 failed with baseline WouldBlock.
The shared HTTPS test harness now waits for runtime initialization before client
connect, retains 5s socket deadlines and prohibits request replay. Four local
TCP/error/readiness tests and complete six-pair ARM macOS HTTPS parity PASS.
Historical throughput deltas reject mismatched timing epochs because startup
compilation is now excluded from the request timing interval. New Intel CI
confirmation and ordinary App/release admission are still pending. See branch
HANDOFF and `admission/current-v2-next/https-startup-macos-aarch64.json`.
Do not refresh v0.0.20 metadata around these future bytes; the old candidate
must continue rejecting this tree as product drift.

The next ordinary App puncture qualifies only Host Clock with clean matching
producer 3b797a77: 113-byte App, 640 calls and Host failure/binding controls;
public artifact-only replays pass Node/Bun/Deno. Four other staged roots reject
generic complex-value/resource Core transport BEFORE source-body type checking.
Read `admission/current-v2-next/ordinary-app.json`; SDK success is not App
success. App scope is 1/5 local, not matching published compiler or release.
Default producer Wasmtime-only build also fails its feature gate; existing
dual-runtime profile passes, and no producer source was changed. Generic Core
transport and default-profile repair are the next producer implementation slice.
The Host-boundary aggregate's nested release-surfaces validation is now guarded
by the existing current-development route; tags retain strict release checks.
Remote failure run 36777376287 is retained in the branch HANDOFF. Counts remain
10/18 built and 5/18 selectable; do not claim package promotion from this slice.

## 2026-09-29 v0.0.20 research-license candidate

Branch `release/v0.0.20-research-license` starts from merged public main
`63ca6c05515de93d6a8d9f8825807313ef882cf7`. The v0.0.20 v2 product candidate
is frozen at `channels/candidates/0.0.20.json`: 309 exact product files,
product-set digest
`d160559aaf863d52d3d585139ed59aaf75da33ec2e6dd0b19eefdda3c6ca9d2a`.
It closes 22 package routes and 140 exported API routes with
`candidate_extras=0`.

This is a license-boundary release, not a compiler or Lib behavior release. It
reuses the exact v0.0.19 compiler bytes, SHA256
`4e0b9779df3bf7b627d7d9fbfc43cfffd67bb053f87c69a9f832c5690b6888a2`,
and all existing Lib artifact bytes. `LICENSE` and `license-policy.json` are now
hash-bound product files. The six Cargo manifests actually included in the new
candidate use `license-file` to bind that research-only, non-commercial license.
The old TCP/UDP manifests are outside the candidate and retain their earlier
metadata. Immutable v0.0.19 and already published packages remain under their
accompanying licenses; this candidate does not claim retroactive revocation.

Local candidate, route-closure, Agent/quickstart, release-surface, dynamic
Client/Gateway model and Cargo packaging checks pass. The exact v0.0.19
candidate rejects the changed tree as product drift, while the compiler digest
remains byte-identical. v0.0.20 is not yet dev, main or prod. Do not refresh the
v0.0.19 global release identity around these future bytes. Next commit and push
this exact candidate, run the full required remote qualification set, retain an
exact qualification receipt, and only then create the metadata-only
`v0.0.20-dev.1` stage.

## 2026-09-29 v0.0.17 Lib admission checkpoint

Branch `release/v0.0.17-lib-closure` starts from synchronized public v0.0.16
post-release commit `0489215f024a75c70adb8bd961c26f31ddb3a0a3`.

Two additive source-free Lib roots are now formally admitted but not yet
released, discoverable or installable:

- `wasmc:data-relational@0.0.2` at `libs/wasmc-data-relational-v002`, source
  authority `cb959cdaa9601bc9ce6a5bd53b2a164bef37cf51`, exact Core
  `97a28721dffd9a3f77a8805110be2a5a57e12cdf9b66026e828de17a876ad4ac`,
  Component `3fe6dbea05308e1cc4d375264410eabaa3b6f8045d6a39ae32725e7a9f967e46`;
- `mcpgit:resident-memory@0.1.0` at `libs/mcpgit-resident-memory`, source
  authority `17ee87a552b430cecf17b0821a9a242603bea0c1`, exact Core
  `1f749247cf65cc6f8555ae37117d2bd177f5cc39312522a5e901a9ce9264dd35`,
  Component `32c356292b251ff7900a5d9a5a4693ec5f7a272cb8cf65dbbc8f628f4482a516`.

Current admission evidence passes Data 77-case semantics, exact Wasmi 2.0
structural execution, the combined 28-candidate registry, MCPGit strict reopen,
and actual Wasmtime Component snapshot/CAS/range execution. The four MCPGit
Core imports are canonical resource lifecycle intrinsics, not Host authority.

Do not refresh v0.0.16 identity files around these future bytes. Next create a
v0.0.17 catalog bound to this admission checkpoint, build and independently
qualify a new LibSearch package for the complete route set, then freeze a new
candidate. Existing package roots and immutable tags remain unchanged.

## 2026-09-29 v0.0.16 dynamic Client/Gateway candidate

The v0.0.16 product candidate is frozen at
`channels/candidates/0.0.16.json`: 242 exact product files, product-set digest
`a91008bb2badb82f803ba0d45bc014db4f02703ec7d05a19b49599dd5d064502`.
It carries forward the unchanged compiler and fourteen admitted Lib package
roots / 108 API routes with `candidate_extras=0`.

The new product surface is `dynamic-client-gateway`, rooted at
`runtime/client-foundation-v1` and
`runtime/client-foundation-gateway-v1`. It is explicitly `incubating` and is
not a formal Lib: admitted, discoverable and installable all remain false for
that higher-layer surface. The fixed Host API and minimal CLI are unchanged.
The bounded authority is
`runtime/client-foundation-v1/release-surface.json`.

Local candidate, release-surface, quickstart, graph/DAG/stateful/restart,
Gateway persistence and WSS cancellation checks pass. The next step is to
commit and push this exact candidate, run the required remote qualification
workflows on that commit, retain their exact successful run identities, and
only then create the metadata-only dev stage. Do not regenerate the candidate
or change any product file after qualification begins.

The first full-history security run found the retained iOS localhost WSS test
private key. It is now admitted only as one object-exact, cryptographically
paired self-signed fixture: the scanner requires the fixed key object, fixed
certificate object, identical SPKI digest, self-issued `CN=localhost`, and SAN
limited to `localhost` / `127.0.0.1`; it records `production_authority=false`.
Raw-only mode still rejects it, and negative tests prove that even the same key
under a changed blob identity is rejected. This remediation changes no frozen
v0.0.16 product byte; remote qualification must use the containing evidence
commit.

The first dynamic Client/Gateway remote run then exposed a close-versus-receipt
race: a queued receipt send could emit an error after the close path had won
and removed its listener. The Client now routes message-processing failure
through an explicit promise in the connection race instead of re-emitting it
on the closing connection. Ten consecutive full local distributed tests pass.
Because this changes a product byte, the earlier candidate was invalidated and
regenerated at the product-set digest above; no earlier remote success may be
used to qualify it.

Exact candidate/evidence commit `d484c09fabcb5876da08ee7a07788bdfd1be0de6`
is qualified for `v0.0.16-dev.1`. Required runs succeeded: LibSearch
`36506803303`, full source-free consumer `36506805611`, dynamic Client/Gateway
`36506800809`, SDK Agent guidance `36506807693`, and release-surface policy
`36506809800`. HTTPS run `36506812014` has all five required modern platforms
successful; the non-blocking legacy `macos-15-intel` job was still compiling
at qualification time. The retained receipt is
`admission/qualification-v016-dev1.json`. Candidate digest remains
`a91008bb2badb82f803ba0d45bc014db4f02703ec7d05a19b49599dd5d064502`.

`v0.0.16-dev.1` is immutable at `575fff2dfee8b561fd160d21e6a5c7c09916acb2`.
The next metadata-only transition is `v0.0.16-main.1`; it must retain candidate
commit `d484c09fabcb5876da08ee7a07788bdfd1be0de6`, the same product-set digest,
and the same qualification receipt. Prod remains v0.0.15 until the final
unpushed rehearsal and two-model Pi gate pass.

`v0.0.16-main.1` is immutable at `3cd18a8004629fda062638c237df883315d10982`.
The working tree now prepares the suffix-free prod metadata, default discovery
and compact orientation for v0.0.16, but this state is not published. Commit it
locally as the final rehearsal, run `scripts/pi-pre-release-gate-v1.mjs` with
both required models, independently review and retain the privacy-safe receipt,
and only then create/push `v0.0.16` and advance `main`.

The first unpushed rehearsal `db3ba316ace59e4e41fc11493c81779a1d34f589`
must not be published. Both models returned the correct v0.0.16 release
orientation with zero tool errors/retries, but the structural oracle still
required v0.0.15 and its prior product-set digest. Update only the release
orientation literals/digest in `agent-evaluation/fresh-agent-learning-v1.json`,
rebuild integrity metadata into a new unpushed rehearsal commit, and repeat the
full two-model gate. Do not reinterpret the correct model answers as a PASS for
the stale oracle.

v0.0.16 is published. Immutable prod tag `v0.0.16` points to rehearsal commit
`dca549848b518b0a528c1b9825c34737845ea248`, tree
`137febe9d80df3f2f6b954c601e1802776a1fcb6`; candidate commit and product-set
digest remain `d484c09fabcb5876da08ee7a07788bdfd1be0de6` and
`a91008bb2badb82f803ba0d45bc014db4f02703ec7d05a19b49599dd5d064502`.
Pi 0.87.1 with `llm-m4dd/deepseek-v4.1-flash` and
`llm-m4dd/glm-5.3-flash` passed all twelve first answers after independent
white-box review: zero tool errors and zero retries. Raw traces and hidden
reasoning are not retained; the privacy-safe receipt is
`agent-evaluation/receipts/pi-pre-release-v016.json` and is committed only
after the tag. HTTPS run `36506812014` later completed successfully on all six
platform jobs, including the non-blocking legacy Intel job. GitHub release:
`https://github.com/cbgroom/wasmcrelease/releases/tag/v0.0.16`.

The first post-release cohort is intentionally retained as a failure rather
than rerun until green. Public raw GitHub and jsDelivr bytes match the tag for
both `release.json` and the compiler. DeepSeek passed 6/6; GLM passed 5/6 with
zero errors and retries, but in `release-state-separation` it wrote the field
name `exact_report.stop_reason` instead of the required exact value
`wasmc-source-direct-resource-methods`. Receipt:
`agent-evaluation/receipts/pi-v016-post-release-regression-dca5498.json`.
This does not mutate or invalidate the release, whose pre-release pair passed;
it is the explicit next guidance-flywheel input. Do not hide it by sampling a
replacement PASS without a guidance change and a new immutable candidate.

## 2026-09-27 v0.0.14 prod hold

Do not promote `v0.0.14-main.1` to prod. White-box product inspection found
stage-stale guidance inside the frozen 213-file candidate: AGENTS, README,
agent quickstart, route readiness, release surfaces and Lib discovery still
identify v0.0.13 or dev qualification as the current lifecycle boundary.
`scripts/validate-v014-prod-readiness.mjs` records this as
`candidate-lifecycle-guidance-is-stage-stale` and confirms public prod remains
v0.0.13. Required recovery: make product guidance lifecycle-neutral, freeze a
new product set, qualify it as `v0.0.14-dev.2`, then repeat exact main/prod
promotion. Never move or rewrite dev.1/main.1 tags.

## 2026-09-27 v0.0.14 main promotion

`v0.0.14-main.1` is the exact metadata-only successor of
`v0.0.14-dev.1`; candidate `f43dd8445717cc0dc38f41077ff239635b8e809d`
and product set
`0eb2d0addf9e0cfe9afb11502848bf0a09a55616c5024727ec98729103a138bc`
are unchanged. `channels/main.json` retains the same successful qualification
runs. Next is the exact main-to-prod transition; public prod/default discovery
remains v0.0.13 until that transition and final integrity checks complete.

## 2026-09-27 v0.0.14 dev qualification

Exact candidate `f43dd8445717cc0dc38f41077ff239635b8e809d` / product
set `0eb2d0addf9e0cfe9afb11502848bf0a09a55616c5024727ec98729103a138bc`
is now qualified as `v0.0.14-dev.1`. Both required runs use source
`7811eb769176d98d4c3f02fbd0a7beaa386ddf20`: LibSearch `36277853994` and
full source-free consumer `36277855490`, both success. Supporting SDK Agent
guidance `36277334732` and six-platform HTTPS `36277334652` also passed on the
frozen candidate commit. The retained receipt is
`admission/qualification-v014.json`; `channels/dev.json` is the stage
authority. Candidate bytes remain unchanged. Next is a metadata-only exact
dev-to-main transition; public prod/default discovery is still v0.0.13.

## 2026-09-27 v0.0.14 LibSearch admission and candidate

LibSearch 0.2.0 exact qualified bytes were copied without rebuilding into
`standard/wasmc-lib-search/0.2.0` at package checkpoint
`e6bc230c29df89b7004935eb5895b7fc3a8bc3f1`. Core remains 53,412 bytes at
`f525deed55a3a942d63c6780b18ac7dc5e496dcf4ce47baaa2da0cbf1795afb1`;
Component remains 55,178 bytes at
`db0e7838424522e23a4f6d0e84759ca6fb631cb3ace516ac6ce514ec39bf831d`.

`catalog/libs-v014.json` binds fourteen exact package roots to that checkpoint.
The admission receipt is `admission/lib-search-v020-v014-admission.json`. The
generated v2 product candidate is `channels/candidates/0.0.14.json`: 213 product
files, fourteen package routes, 108 API routes, `candidate_extras=0`, exact
closure true. Read its product-set digest live after any regeneration.

This closes qualification -> admission and candidate creation only. Immutable
v0.0.13 and `channels/prod.json` remain unchanged. LibSearch 0.2.0 states are
qualified=true, admitted=true, released=false, discoverable=false and
installable=false. The next authority is exact dev-stage qualification of the
unchanged v0.0.14 product; do not create main/prod stage metadata or move default
discovery before that evidence exists.

## 2026-09-27 Pi Lib-route readiness flywheel

Pi 0.87.1 was run on the same focused release-readiness question with the
cost-controlled `llm-m4dd/deepseek-v4.1-flash` and
`llm-m4dd/glm-5.3-flash` routes. The baseline exposed a guidance problem rather
than a product-count ambiguity: the facts were spread across large surfaces,
so DeepSeek used 12 calls / 134,976 result characters and GLM used 10 calls /
32,853 characters. GLM also proposed two invalid shortcuts: historical
v0.0.13 candidate verification as a current readiness command, and removing
the active LibSearch route instead of admitting it.

The remediation adds generated `release-lib-route-readiness.json` as the
bounded first authority for this exact decision. Its counts and blocker are
derived from the release-wide closure and ecosystem control plane; quickstart
and release-surface validators require exact agreement. It explicitly rejects
14/108 as proof of readiness, active-route deletion, historical verification,
and qualification/admission conflation. Drift fails
`scripts/lib-ecosystem-control-plane.mjs --check`.

An intermediate GLM answer still left an ambiguous “otherwise match” escape,
so the final authority also binds `valid_resolution_count=1` and states that
there is no alternative route-set repair. The unchanged question then passed
semantically and structurally on both models. DeepSeek used four tool calls and
GLM used two, both in three assistant turns, with 2,900 and 2,344 tool-result
characters respectively; both had zero errors, retries,
duplicate calls, repeated reads and zero-yield results. Both read the bounded
authority first, ran exactly its two checks, preserved immutable v0.0.13 at
13 packages / 105 API routes, reported future 14 / 108 plus one candidate
extra, stopped at admission of `wasmc:lib-search@0.2.0`, and rejected both bad
shortcuts. Exact metrics and final-answer digests are retained in
`agent-evaluation/receipts/pi-lib-route-readiness-flywheel-dcf8aeb.json`.
Raw traces and hidden reasoning are not retained. This is a focused diagnostic,
not a rerun or replacement of the frozen six-case controlled-pair qualification.

## 2026-09-27 Release-wide Lib route closure

The recurring LibSearch omission class is now fail-closed rather than repaired
one release at a time. `scripts/lib-route-closure.mjs` follows `release.json` to
the exact staged product, reads every released `lib.json`/`lib.wit`, derives all
exported interface functions and resource constructor/method identities, and
requires exact equality with both the selected catalog and LibSearch LSI.

The retained `catalog/lib-route-closure.json` currently proves 13 released
package bindings and 105 released API bindings. The unreleased LibSearch 0.2.0
candidate is the sole explicit extra, contributing one package and three API
routes, for 14 / 108 total. It remains released=false and grants no install or
selection authority. Negative tests reject missing catalog rows, missing package
routes, missing API routes, unexpected packages and version drift. The gate is
wired into LibSearch CI, the integrity suite, maintainer validation, release
surface validation and the generated ecosystem control plane. It derives from
the staged product dynamically; it does not hard-code v0.0.13 as the future
package inventory. Formal candidate creation now emits only schema v2 and
requires zero candidate extras. It therefore intentionally blocks the next
release while LibSearch 0.2.0 remains outside the product/catalog; admitting the
active search package is required before a new release candidate can exist.
The retained closure exposes this directly as `formal_release_ready=false` and
`blocking_conditions=[active-lib-search-candidate-extra]`.

Focused catalog/install/search behavior, route-closure checks, six negative
route mutations, fifteen release transition/candidate mutations, release
surfaces, integrity and maintainer validation pass. The unified integrity suite
runs both new route gates successfully; its sole remaining failure is the
pre-existing immutable v0.0.13 candidate rejecting current main-side future
guidance as `product drift rejected`. Do not rewrite that old candidate.

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
though the producer commit, index and Cargo.lock were exact. The repair is now
integrated in wasmc master `f6fc94432101250b8583834b51229bedb1cd8314`.
Two independently published candidate roots under exact fingerprint
`2e4e27cb0b3644dd0c90bb71f31de5b5c72cd47671373caab8b9146ac68bf8ca`
are byte-identical, and `lib.json` now binds the full normalized toolchain row
at SHA-256 `ef63bdb8bb991903ef182999d1ccd22ddffca7bff66e1a0754a7a90a73b719a5`.
Core and Component bytes remain unchanged; the regenerated Rust binding pins
Wasmtime 49.0.0 and its generated crate passes an offline `cargo check`.

Public candidate search/reference regression, generated Wasmtime 49 binding
offline check, control-plane regeneration, release-surface validation and the
complete maintainer integrity gate all pass. Qualification remains true while
admitted/released/discoverable/installable remain false. The next slice is a
separate future-candidate admission decision; do not rewrite v0.0.13 or relabel
LibSearch 0.1.0.

A focused Pi 0.87.1 probe on commit `7e3e49e` then asked both controlled models
to recover the five states and full reproducibility identity. Both returned the
exact state row, build-tool commit, fingerprint, target, flags and manifest
digest with no tool errors, retries or duplicate reads. GLM used 3 tool calls;
DeepSeek used 13. White-box review did not blindly accept the answers: GLM's
wording could be read as if `catalog/libs-v013.json` installed the 0.2.0
candidate. It does not; it is the 13-package producer input catalog and contains
only LibSearch 0.1.0. The admission receipt and control plane now expose
`role=producer-input-catalog`, `contains_candidate=false` and
`candidate_install_authority=false`, with executable assertions. Compact
diagnostic evidence is retained at
`agent-evaluation/receipts/pi-lib-search-toolchain-probe-7e3e49e.json`; it is
not a replacement for the frozen six-case controlled-pair qualification.

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

## 9. v0.0.14 Post-release Pi Regression (2026-09-27)

The immutable `v0.0.14` tag at `c0c95f8c62c2d413a6dd28f9c46203409dc15b13`
was regressed with Pi `0.87.1`, one fresh detached clone and session per case,
and both controlled routes: `llm-m4dd/deepseek-v4.1-flash` and
`llm-m4dd/glm-5.3-flash`. Route labels identify the observed local routes; they
do not independently attest upstream implementations. Raw conversations and
hidden reasoning were not retained.

Controlled-pair qualification is **false**. DeepSeek structurally passed 5/6
cases but exceeded the 60,000-character orientation budget and later misspelled
the exact telemetry package identity. GLM structurally passed 4/6, exceeded the
same orientation budget, and corrupted/ellipsized an exact WIT digest in the
Library-first case. Neither route had a timeout, tool error, retry, duplicate
call, repeated read, or zero-yield result, so these are guidance/oracle defects
rather than transient tool failures.

Next-release flywheel work is bounded to three changes: provide a compact
authoritative orientation/lifecycle record instead of forcing agents through
more than 60 KB of overlapping material; make the public Base64 quickstart use
the current `v014` catalog route instead of the valid but retained `v009`
example; and add field-by-field oracle checks for reported package identities
and digests. Do not modify the immutable v0.0.14 tag or weaken the evaluator.
The privacy-safe exact receipt is
`agent-evaluation/receipts/pi-v014-post-release-regression-c0c95f8.json`.

The release-order defect is now explicit. The earlier controlled-pair PASS was
bound to guidance commit `bb9615a`, while the final product candidate was
`6cb3aaf` and the prod release tree was `c0c95f8`; promotion did not require a
fresh live-pair receipt for that final tree. The former CI label also described
a synthetic cohort-contract test as though it were a live Pi run.

Future releases must assemble the final prod commit locally in an isolated
worktree and run `scripts/pi-pre-release-gate-v1.mjs` before tagging or pushing.
The gate validates every candidate product byte at that commit, verifies the
final prod lifecycle view, runs the two Pi routes concurrently in fresh clones,
and rejects any receipt not bound to the exact rehearsal commit/tree, candidate
commit and product-set digest or lacking structural and independent white-box
first-pass acceptance. The deterministic CI case is renamed and separated from
this live gate. The receipt is added after the tag to avoid self-reference.
