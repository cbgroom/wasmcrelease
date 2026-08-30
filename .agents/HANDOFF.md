# wasmc release maintainer handoff

## 0. Status

- Branch: public release candidate for `main`
- Release: additive `v0.0.4` built from private `wasmc@b8344d65`
- Public tag target: the final source-free release commit
- Existing immutable truth: `v0.0.1`, `v0.0.2`, and `v0.0.3` remain unchanged

## 1. North Star

Let a zero-context Agent select an immutable release, load the bundled developer or Lib Skill, reuse Rust/WIT priors, compile through the smallest public path, grant only explicit imports, and prove behavior without private-source knowledge.

## 2. Current Focus

Publish `v0.0.4` additively while mutable `main` becomes the discovery surface for `latest=0.0.4`. The source-free release contains compiler/JS bytes, matching Lib Core, three WIT-native Core/Component Libs, developer/per-Lib Skills, and a locked Rust/Wasmtime demo; it exposes no FastAPI compatibility name.

## 3. Recent Progress

- Private delivery is accepted from clean synchronized source commit `b8344d65a942133f6af62b9a27093f50e2c22b79`.
- Node, Bun, and Deno package/single/global/CLI outputs are byte-identical.
- WIT resources, receiver methods, drop, explicit Host imports, and negative drift checks pass under Wasmtime.
- The public assembler produced 56 source-free files, developer/per-Lib Skills, admission receipts, and SHA-256 identities.
- Exact v0.0.4 distribution observations remain below frozen budgets: compiler Wasm `1483217`, package `1537927`, single ESM `2042705`, and classic script `2040866` bytes.

## 4. Current Action

Task state: publication-ready

- Result: source-free `v0.0.4` is locally assembled and verified from the fixed private-source commit, ready for one immutable tag and mutable latest-pointer update.
- Evidence: complete private workspace tests, three-host JS parity, generated Lib/WIT gates, delivery closure, assembler verification, and source-free checks pass.
- Residual risk: CDN propagation and independent pinned-download parity are external post-push evidence; `v0.0.4` remains an early `stable=false` release.
- Next action: push public `main` and annotated `v0.0.4`, then verify GitHub Raw, pinned jsDelivr, latest metadata, downloaded JS execution, and fresh-tag Rust/Wasmtime execution.

## 5. Next Actions

1. Keep `package-index.json` as the mutable discovery surface; never move an existing release tag.
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
- Do not restore FastAPI aliases.
- Do not mutate or retag `v0.0.1` through `v0.0.3`.
- Do not call the Rust demo an SDK or make GitHub Actions a release dependency.

## 8. Recovery / Resume Commands

```bash
cd /Users/youxianshi/code/wasmcrelease
git status --short --branch
./scripts/maintainer-orient.sh
```
