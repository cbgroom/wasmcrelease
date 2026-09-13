# WAsmC release maintainer handoff

## 0. Status

Task state: in-progress — public Wasmi-only compiler adapter and native packaging.
Next coherent stage START: user authorizes all-platform Actions delivery.
Prior exact-source run34745618036 PASS on Linux x64/macOS arm64/Windows x64.
Expand to six native desktop targets with package manifests and download-stage
execution. Mobile and dual SDK remain distinct gates; do not call six desktop
targets all devices. No old tag movement or compiler rebuild.
Own branch: work/native-wasmi-compiler, based on origin/main at START.
Approved design: privately produced compiler Wasm stays digest-bound; public
Actions build only integration glue. Separate Wasmi-only and dual-engine
profiles, CLI plus SDK; mobile packaging and promotion are subsequent gates.
First slice: exclusive resident compiler instance with fuel/memory/input limits,
copy-before-clear output, import rejection, native compile/inspect and JS byte
parity. Existing frozen SDK and all64 promoted product files remain untouched.
START checkpoint pushed. Public independent compiler SDK/CLI implemented:
fixed compiler digest, bounded resident Wasmi instance, copy-before-clear,
diagnostic recovery and trap poisoning, no-clobber scalar compile command.
Local Rust3/3, strict Clippy, JS byte parity5/5, no-clobber5/5 and actionlint
PASS. Locked dependency tree has no Wasmtime/Cranelift. Three-OS native Actions
build/test/parity plus exact-source development artifacts added; remote results
must still be read. No inspect/run/serve, Host SDK, dual promotion or mobile
packaging claim. New independent crate does not replace the frozen SDK.
Do not claim a new release or full
Wasmi Std compatibility: Std1.4 still requires unsupported engine features.
Resume: implement independent public adapter, focused tests, locked dependency
tree, integrity/maintainer gate, push and exact-source Actions qualification.

Previous completed stage:
Own branch: docs/agent-library-first-guidance. Base is published v0.0.10.
Plan: route AGENTS/developer to a concrete discovery Skill, teach search hits,
exact selection/installation and verification; exercise canonical examples and
reject missing routes, escaping paths and drift. Frozen Lib roots and all64
promoted product files stay unchanged. Supplemental guidance lives on this
branch/full commit until its next immutable release. No binaries or tags rebuilt.
START is pushed. AGENTS/developer now route to concrete wasmc-lib-discovery;
catalog/install availability and search-v2 descriptions are corrected without
changing frozen product Skills. Two teaching commands verify five target hits;
six rejection controls, eight-Skill/three-parent validation and64-product
digest check PASS. Maintainer validation and deterministic Fresh-Agent100/100
PASS. Exact implementation public guidance CI run34743590650 PASS. No new
immutable release is implied; v0.0.10 remains frozen. This is supplemental
main/full-commit guidance. Resume: verify origin/main reachability and both new
guidance/full consumer workflows at their exact source; next work is stronger
zero-context task-corpus evaluation, not another language syntax expansion.
Branch: release/lib-search-v010. Public v0.0.9 is already released;
immutable tag and release branch remain unchanged. Main may carry follow-up
consumer tooling/docs, not new admitted compiler or Lib binaries.

## 1. North Star

Library-first typed WIT programming, CoreLib-owned storage and explicit Host
authority. Feature compatibility is artifact-specific, not a guessed Node
major-version promise or a language-memory-management change.

## 2. Current Focus

User authorized production-grade LibSearch after qualification and accepted
dev -> main -> suffix-free prod identities. Policy is docs/RELEASE_CHANNELS.md.
The new Lib root is imported from the clean pushed private authority recorded
in admission/lib-search-v010.json. Private producer remains build authority;
the public tree contains only verified products and public comparison corpus.
dev/main prerelease tags are published with unchanged products. This tree holds
final prod metadata. Resolve publication from remote tag peel, GitHub Release
and origin/main rather than treating candidate metadata as proof. If all agree
and both exact-candidate workflows pass, publication is complete; otherwise
resume qualification/promotion without moving tags or rebuilding products.
Plan: portable formal API/Component/SDK tests, all negative controls, exact-source
product provenance, public source-free CI comparison and stage-aware promotion.
No compiler rebuild here; do not move v0.0.9 or make dev/main default prod.
Resume: qualify and push the exact candidate, read both live CI workflows,
then publish/promote stages without changing product bytes.

Install caller-pinned exact public Lib bytes from fixed HTTPS mirrors after
complete validation; publish atomically without overwriting any destination.
CoreLib companion remains exact; installation never grants Host capability.

## 3. Existing Evidence

v0.0.9 compiler build/qualification and same-archive Host receipts live under
admission/. Exact-release Actions run34726851005 passed all five jobs. Those
results cover their named Hosts, not Node18 or every future engine version.
Current/ owns current compiler entrances; dist/package/libs are frozen v0.0.4.

## 4. Plan and Validation

User requested all current public tests in Actions and README result display.
Add finite executable suites, Linux/macOS JS matrices, both live mirrors,
full-history credential negatives/scan, deterministic Fresh-Agent regression,
Rust/Wasmi/Wasmtime consumer tests, always-written exact-source reports and
workflow aggregate status. README native badge is CI status, never fabricated
source-line or all-stdlib coverage. No automatic README commits/write token,
binary rebuilding, release/tag move or production deployment. Validate runner
failure controls, YAML and live Actions before main acceptance.

Implement caller-pinned lock-file installation from fixed exact-source HTTPS
mirrors. Share exact catalog selection; verify all files/companion before atomic
no-clobber symlink publication. Private staging cleanup on failure, no fallback,
redirect, automatic engine admission or Host grant. Unix Node/Bun/Deno only.
Use controlled fault fixtures, concurrent install rejection and fresh public
downloads with installed standard execution. No binary rebuild or Cargo pool.
Resume: own START push, then narrow install implementation/tests/docs and CI.

Add a finite approved catalog of existing immutable v0.0.9 packages; discovery
is not selection authority. Resolve only caller-pinned catalog/WIT/artifact
digests and exact version, with one unique candidate and complete file checks.
No semver solving, downloads, installation, builds, authority or binary changes.
Fix stale v0.0.8 public entrypoint without changing frozen trees.
Validate real package resolution, ambiguity/drift/path rejection and all current
Host regression gates. This is a supplemental main tool, not an original tag API.

Inspect actual Core types/operators with wasm-tools; obtain official pinned
Node18 runtime with SHA verification; compare compiler/provider/std separately.
Use independent minimal feature probes and feature-disabled validation to
identify the rejection. Add digest-bound consumer compatibility metadata and
deterministic preflight only after actual evidence. Validate probes/negatives,
current corpus, standard caller oracle, integrity and unchanged artifacts.

## 5. Current Action

New search Root imported from clean pushed private authority in
admission/lib-search-v010.json; compiler/CoreLib unchanged. Public source-free
Node18/26, Bun and Deno formal API576-case comparison run locally. Each
compares Rust-produced search with independent WAsmC and JS algorithms,
including ASCII-only folding, non-ASCII whitespace and bounded u32 paging;
each also completes11000 resident calls with18 memory pages. Typed client passes.
New lib-search workflow covers10 JS OS/runtime cells, actual Wasmi Core and
generated Rust Component SDK in release profile; full CI also checks immutable
product inventory and12 promotion negatives. dev/main products are accepted by
both complete exact-source runs in channels/main.json and eligible for prod.
Publication requires final-candidate gates and fresh tag/main checks; inspect
live runs at this tree's exact Git source and verify the immutable public tag.
Product identity is channels/candidates/0.0.10.json,
not the root's default-prod discovery version. All parent Skills now exist.

Agent guidance branch has full successful source-free CI run34740318776 at its
exact source. It is integrated here without altering release tags/products.
This closes the generated Lib Skill's otherwise missing wasmc-lib parent.

Root release/capability/CDN identity and public Skill unique-name/parent-chain
validation is now shared by maintainer and Fresh-Agent gates. Seven negative
fixtures cover stale identities, missing standard discovery, missing parent,
duplicate identity and parent cycle. Added real wasmc-lib consumer guidance
outside frozen Std package; no frozen inventory or binary changed. Initial
Fresh-Agent execution before checksum refresh rejects stale candidate integrity
(95points); guidance itself passes. After refresh, maintainer gate and all seven
negative fixtures pass; Fresh-Agent accepts100/100 with guidance contract true.
An archived immutable v0.0.9 independently rejects stale root version, missing
standard route and missing parent after controlled in-memory normalization.
No archived tag files were changed. Push this checkpoint and read live CI next.
SDK18 does not exercise App→Std→CoreLib on Wasmi. That complete graph and a
source-authority Portable variant remain unclosed; do not label this stage
cross-platform Std support. Five closure items: Portable, preflight release,
catalog/install release, Agent guidance, public build. No new release yet.

Expanded run34730577345 fully succeeded:22 jobs,21/21 suite cells,130/130 flow
checks, SDK18/18 with0failure/ignored/filtered. Exact source31259 resolves from
admission/public-ci-coverage-v009.json. Aggregate JSON was independently
downloaded/read, all source identities and required cells match. Snapshot
retained in Git; README live badge plus exact tested baseline/link are separate.
These following receipts change metadata only, not workflow/test/binary code.
Resume: validate this receipt integrity/current reporting controls, push own
branch and expected-base main, then exact remote/unchanged-tag readback.

Comprehensive workflow defines21 test-suite cells and required aggregate job.
Both OS Hosts/mirrors, compatibility, full archived execution, security history,
Fresh-Agent and locked release Rust are registered in ci-suite.mjs.
README native main/push badge and scope table route to summaries/artifacts.
Reporting controls reject exit failure, false accepted JSON, timeout, missing/
duplicate/source/Host/test mismatches and skipped family. Actionlint1.7.12 and
YAML parse pass. Local integrity/Fresh-Agent and full Deno/jsDelivr pass.
An early dirty candidate correctly failed stale checksum checks; refresh passed.
Original candidate/source and its full run remain preserved. No source-line
coverage, producer rebuild, production/browser or third-party authoring claim.

Controlled install tests pass Node/Bun/Deno: ten failure boundaries, one winner
under concurrency, competing-directory preservation and failed-stage cleanup.
Actual install CLI freshly downloads eleven std/companion files. GitHub Raw
passes all three Hosts; jsDelivr passes Node; each installed standard execution
passes5120 paired calls. Exact harness evidence is being collected in
admission/public-lib-install-v009.json. Exact harness collection completed.
Actions run34730052200 passed seven JS/compatibility/integrity jobs, including
fresh install and installed execution on all three Hosts; full Rust rebuild
still running at this checkpoint. Prior catalog run34729685220 is full success.
Deno Node-compat launcher permission
failures are preserved; native clearEnv launcher passes without broad env grant.
No compiler/Lib binaries changed. Unix symlink atomic visibility is not
directory-fsync/power-loss durability or a Windows promise.
Resume: finalize evidence/integrity, push owning branch, run targeted Actions,
expected-base main advance, unchanged-tag readback and Release notes readback.

Offline public search/exact resolve verifies four real package inventories and
std CoreLib companion. Three JS Hosts pass ten negative boundaries and equal
repeated receipts; existing standard caller5120 checks pass each Host.
admission/public-lib-catalog-v009.json binds harness/catalog hashes and Hosts.
AGENTS current version/artifact paths and public authoring status corrected.
Compatibility run34729449573 subsequently completed full success.
Actions run34729685220 passed seven JS/compatibility/integrity jobs, including
the new catalog tests; full Rust rebuild remains running at this checkpoint.
Resume: publish own branch/main with expected-base fast-forward, verify remote
and unchanged tag, update Release instructions/readback, then pinned install.

Independent five-Host evidence is admission/core-compatibility-v009.json.
Node18 reproduces value-type0x64 at265; standard requires function-references
and tail-call beyond wasm2. Node22/26, Bun and Deno pass full standard calls.
Compiler-only Node18 passes; full managed Host also lacks global WebCrypto.
Digest-bound preflight and six negative tests pass on all five Hosts.
No original114-case reproduction or external performance-number adoption.

## 6. Next Actions

Current bounded download/install slice is qualified100percent. The four
delivery closure gates are compatibility, catalog/exact resolve, download/
install, and public third-party build: first three implemented (3/4), authoring
remains. This denominator is not all-stdlib coverage or system/Ultra readiness.
Next close public third-party authoring through
existing private source-authority machinery, without inventing language APIs.

Compatibility instructions/evidence and v0.0.9 Release notes are published.
Main and this branch are synchronized; the immutable release tag is unchanged.
Actions run34729449573 passed all seven JavaScript/integrity/compatibility jobs;
the unrelated full Rust rebuild was still running at this checkpoint.
Local complete current tests, maintainer gate and credential negatives passed.
Do not call this new Actions run fully green before reading its final status.
Third-party build remains its own source-authority stage; do not invent shipped
commands or duplicate compiler build/semantic machinery here.

## 7. Boundaries

No tag/immutable release-branch movement, binary regeneration, private compiler
source exposure, MCPGit deployment, Python workflow or new heavy Cargo pool.
Do not infer complete required features from target_features custom metadata.
Do not label the complete module's validation a proof of allocator isolation.

## 8. Recovery

git status --short --branch; git rev-parse HEAD; git ls-remote origin
Read branch HANDOFF and committed evidence. Keep owned downloaded runtimes and
test outputs under ignored target/; preserve unrelated worktrees and caches.

## 9. Completion Gate

Independent exact-artifact reproduction, proven feature diagnosis, deterministic
compatibility rejection before instantiation, digest/negative tests and clear
public instructions. Start/partial checkpoints do not imply completed work.
