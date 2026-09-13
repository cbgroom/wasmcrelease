# WAsmC release maintainer handoff

## 0. Status

Task state: published — independent Node18/standard-Lib feature reproduction.
Branch: fix/node18-feature-admission. Public v0.0.9 is already released;
immutable tag and release branch remain unchanged. Main may carry follow-up
consumer tooling/docs, not new admitted compiler or Lib binaries.

## 1. North Star

Library-first typed WIT programming, CoreLib-owned storage and explicit Host
authority. Feature compatibility is artifact-specific, not a guessed Node
major-version promise or a language-memory-management change.

## 2. Current Focus

External tpc02 report says Node18.19.1 accepts the current compiler but rejects
std1.4.0 artifact with value-type0x64. Original scripts/logs are unavailable.
Treat that report as attributed observation, not official measurement. Rebuild
a minimal independent test against immutable public v0.0.9 artifact digests.

## 3. Existing Evidence

v0.0.9 compiler build/qualification and same-archive Host receipts live under
admission/. Exact-release Actions run34726851005 passed all five jobs. Those
results cover their named Hosts, not Node18 or every future engine version.
Current/ owns current compiler entrances; dist/package/libs are frozen v0.0.4.

## 4. Plan and Validation

Inspect actual Core types/operators with wasm-tools; obtain official pinned
Node18 runtime with SHA verification; compare compiler/provider/std separately.
Use independent minimal feature probes and feature-disabled validation to
identify the rejection. Add digest-bound consumer compatibility metadata and
deterministic preflight only after actual evidence. Validate probes/negatives,
current corpus, standard caller oracle, integrity and unchanged artifacts.

## 5. Current Action

Independent five-Host evidence is admission/core-compatibility-v009.json.
Node18 reproduces value-type0x64 at265; standard requires function-references
and tail-call beyond wasm2. Node22/26, Bun and Deno pass full standard calls.
Compiler-only Node18 passes; full managed Host also lacks global WebCrypto.
Digest-bound preflight and six negative tests pass on all five Hosts.
No original114-case reproduction or external performance-number adoption.

## 6. Next Actions

Compatibility instructions/evidence and v0.0.9 Release notes are published.
Main and this branch are synchronized; the immutable release tag is unchanged.
Actions run34729449573 passed all seven JavaScript/integrity/compatibility jobs;
the unrelated full Rust rebuild was still running at this checkpoint.
Local complete current tests, maintainer gate and credential negatives passed.
Do not call this new Actions run fully green before reading its final status.
Defer catalog/third-party build work to
its own source-authority stage; do not invent shipped commands here.

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
