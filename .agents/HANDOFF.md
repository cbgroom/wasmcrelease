# WAsmC release maintainer handoff

## 0. Status

- Branch: `main`
- Base: public `main` at `39bccad7fa509000bb76a9975665aa4b0f5c6fdf`
- Public release truth: immutable tag `v0.0.2`
- Repository role: source-free public distribution and integration guidance

## 1. North Star

Let a zero-context Agent select an immutable WAsmC release, write supported
source using model-prior-familiar Rust/WIT concepts, compile it through the
smallest public host path, grant only explicit imports, and prove behavior.
Keep planned/private capability visibly separate from shipped public capability.

## 2. Current Focus

Use the integrated maintainer system and FastAPI acceptance gate to prepare the
next public managed-source-capable release without weakening `v0.0.2` identity.

## 3. Recent Progress

- `v0.0.2` ships compiler Wasm, FastAPI Core 4.3, JavaScript facade, Rust
  Wasmtime demo, language guide, and five executable Agent examples.
- Live inspection confirms the public facade does not export `compileFastapi`.
- The public scalar examples pass through the shipped facade and compiler.
- Three narrow Skills now own release integrity, Agent docs, and Host integration.
- Public docs now separate task routing, language, hosting, and FastAPI availability.
- Deterministic validation checks Skill structure, manifest/checksums, Markdown
  links, facade exports, structured language probes, and managed-source nonclaims.
- Workstream `work/release-maintainer-skills-v0` is integrated into public `main`.

## 4. Current Action

Task state: completed

- Result: public `main` has a minimal repository-owned maintainer Skill tree and
  a first-screen public Agent contract grounded in `v0.0.2` behavior.
- Evidence: `./scripts/validate-maintainer.sh`, the five-case Agent runner, and
  `cargo test --locked` in the Rust Wasmtime demo all pass.
- Residual risk: no independent external zero-context Agent has yet consumed the
  branch; browser/CDN behavior was not rerun because package bytes did not change.
- Next action: admit the next compiler/facade/provider candidate from the private
  source authority, then satisfy the public FastAPI acceptance gate before tagging.

## 5. Next Actions

1. Add the public managed-source facade and complete link/init/invoke/cleanup example.
2. Add executable string/list/map/object consumer examples from the same candidate.
3. Run a zero-context external Agent consumer gate before the next tag.

## 6. Validation Commands

```bash
./scripts/validate-maintainer.sh
node examples/agent-start/run.mjs
(cd examples/rust-wasmtime && cargo test --locked)
```

## 7. Do Not Do

- Do not publish private-main capability as current `v0.0.2` behavior.
- Do not teach Agents to call provider-private handles or lifecycle functions.
- Do not mutate or retag `v0.0.2`.
- Do not make GitHub Actions a required release path.

## 8. Recovery / Resume Commands

```bash
cd /Users/youxianshi/code/wasmcrelease
git status --short --branch
git fetch --prune origin
./scripts/maintainer-orient.sh
```
