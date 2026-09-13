# WAsmC release maintainer handoff

## 0. Status

Task state: started — independent Node18/standard-Lib feature reproduction.
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

Resume by independently testing exact artifacts on Node18 and current Hosts.
No original114-case reproduction or external performance-number adoption.

## 6. Next Actions

After reproduction, publish self-contained compatibility evidence/instructions
and update the Release explanation. Defer catalog/third-party build work to
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
