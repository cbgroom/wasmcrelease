# wasmc release maintainer handoff

## 0. Status

- Branch: public `main@da221b2`
- Release: immutable `v0.0.3` built from private `wasmc@421aaa33`
- Public tag target: `da221b2b36de439de2bbdd86d75ddd738f20ffa5`
- Existing immutable truth: `v0.0.1` and `v0.0.2` remain unchanged

## 1. North Star

Let a zero-context Agent select an immutable release, load the bundled developer or Lib Skill, reuse Rust/WIT priors, compile through the smallest public path, grant only explicit imports, and prove behavior without private-source knowledge.

## 2. Current Focus

Keep `v0.0.3` reproducible and immutable while mutable `main` remains the discovery surface for `latest=0.0.3`. The published release contains compiler/JS bytes, matching Lib Core, three WIT-native Core/Component Libs, developer/per-Lib Skills, and a locked Rust/Wasmtime demo; it exposes no FastAPI compatibility name.

## 3. Recent Progress

- Private delivery is accepted from clean synchronized source commit `421aaa33f2d340c312f394a8c0cf5c95a9ad186c`.
- Node, Bun, and Deno package/single/global/CLI outputs are byte-identical.
- WIT resources, receiver methods, drop, explicit Host imports, and negative drift checks pass under Wasmtime.
- The public assembler produced 54 source-free files, developer/per-Lib Skills, admission receipts, and SHA-256 identities.
- Public `main` was pushed at `da221b2`; annotated tag `v0.0.3` dereferences exactly to that commit while `v0.0.1` and `v0.0.2` remain unchanged.
- GitHub Raw and pinned jsDelivr returned exact local bytes for eight representative metadata, compiler, facade, Lib Core, Component, and developer-Skill surfaces.
- A facade downloaded only from jsDelivr compiled and executed scalar plus managed String/List/Map programs; a fresh shallow clone of public `v0.0.3` passed locked Rust/Wasmtime tests and returned `44/17/15/42`.

## 4. Current Action

Task state: release-complete

- Result: source-free `v0.0.3` is published and independently consumable from GitHub/jsDelivr without the private repository.
- Evidence: final pre-publication scan covered 143/143 reachable blobs and 4,964,569/4,964,569 bytes with zero findings, skips, or errors; pinned fetch parity, downloaded JS execution, and fresh-tag Rust execution pass.
- Residual risk: `v0.0.3` is still an early `stable=false` release; capability growth must preserve WIT authority, explicit Host grants, size tiers, and the existing immutable tag.
- Next action: collect real caller feedback against the fixed `v0.0.3` contract and prepare any additive change as `v0.0.4` or later.

## 5. Next Actions

1. Keep `package-index.json` as the mutable discovery surface; never move `v0.0.3`.
2. Reproduce caller issues first against the pinned tag and bundled Skills.
3. Admit future versions through the same source-free scan, parity, Agent, CDN, and Rust/Wasmtime ladder.

## 6. Validation Commands

```bash
./scripts/validate-maintainer.sh
node examples/agent-start/run.mjs
(cd examples/rust-wasmtime && cargo test --locked && cargo run --locked)
```

## 7. Do Not Do

- Do not copy private compiler source or build caches.
- Do not restore FastAPI aliases in `v0.0.3`.
- Do not mutate or retag `v0.0.1` or `v0.0.2`.
- Do not call the Rust demo an SDK or make GitHub Actions a release dependency.

## 8. Recovery / Resume Commands

```bash
cd /Users/youxianshi/code/wasmcrelease
git status --short --branch
./scripts/maintainer-orient.sh
```
