# wasmc release maintainer handoff

## 0. Status

- Branch: `work/release-v0.0.3`
- Base: public `main@f89ae98`
- Candidate: source-free `v0.0.3` built from private `wasmc@421aaa33`
- Existing immutable truth: `v0.0.1` and `v0.0.2` remain unchanged

## 1. North Star

Let a zero-context Agent select an immutable release, load the bundled developer or Lib Skill, reuse Rust/WIT priors, compile through the smallest public path, grant only explicit imports, and prove behavior without private-source knowledge.

## 2. Current Focus

Admit and publish `v0.0.3` with compiler/JS bytes, matching Lib Core, three WIT-native Core/Component Libs, developer/per-Lib Skills, and locked Rust/Wasmtime evidence. Remove the FastAPI public name from this version without changing old tags.

## 3. Recent Progress

- Private delivery is accepted from clean synchronized source commit `421aaa33f2d340c312f394a8c0cf5c95a9ad186c`.
- Node, Bun, and Deno package/single/global/CLI outputs are byte-identical.
- WIT resources, receiver methods, drop, explicit Host imports, and negative drift checks pass under Wasmtime.
- The public assembler produced 54 source-free files, developer/per-Lib Skills, admission receipts, and SHA-256 identities.

## 4. Current Action

Task state: candidate-complete

- Result: the source-free public tree and Agent/Lib Skill routing are candidate-complete for `v0.0.3`.
- Evidence: refreshed manifest/checksums pass; scalar and managed Lib Agent journeys pass; five teaching programs pass; locked Wasmtime compiler/resource/Host tests and executable return `44/17/15/42`.
- Residual risk: no public capability exists until commit, immutable tag, push, and independent fetch checks pass.
- Next action: scan the committed candidate history, merge to public main, tag `v0.0.3`, then verify GitHub/jsDelivr bytes and latest metadata.

## 5. Next Actions

1. Regenerate `manifest.json`, `release.json`, and `SHA256SUMS` over the final tree.
2. Run public JavaScript, Agent, Lib, and Rust/Wasmtime journeys from this worktree.
3. Push `main`, create immutable `v0.0.3`, and verify pinned and latest CDN identities.

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
cd /Users/youxianshi/code/.worktrees/wasmcrelease/release-v0.0.3
git status --short --branch
./scripts/maintainer-orient.sh
```
