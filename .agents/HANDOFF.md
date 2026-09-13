# WAsmC release maintainer handoff

## 0. Status

Task state: qualification in progress — pinned public Lib download/install.
Branch: feat/public-lib-install. Public v0.0.9 is already released;
immutable tag and release branch remain unchanged. Main may carry follow-up
consumer tooling/docs, not new admitted compiler or Lib binaries.

## 1. North Star

Library-first typed WIT programming, CoreLib-owned storage and explicit Host
authority. Feature compatibility is artifact-specific, not a guessed Node
major-version promise or a language-memory-management change.

## 2. Current Focus

Install caller-pinned exact public Lib bytes from fixed HTTPS mirrors after
complete validation; publish atomically without overwriting any destination.
CoreLib companion remains exact; installation never grants Host capability.

## 3. Existing Evidence

v0.0.9 compiler build/qualification and same-archive Host receipts live under
admission/. Exact-release Actions run34726851005 passed all five jobs. Those
results cover their named Hosts, not Node18 or every future engine version.
Current/ owns current compiler entrances; dist/package/libs are frozen v0.0.4.

## 4. Plan and Validation

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

Controlled install tests pass Node/Bun/Deno: ten failure boundaries, one winner
under concurrency, competing-directory preservation and failed-stage cleanup.
Actual install CLI freshly downloads eleven std/companion files. GitHub Raw
passes all three Hosts; jsDelivr passes Node; each installed standard execution
passes5120 paired calls. Exact harness evidence is being collected in
admission/public-lib-install-v009.json. Deno Node-compat launcher permission
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

Current bounded download/install slice is under final qualification. The four
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
