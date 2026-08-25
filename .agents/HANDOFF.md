# WAsmC release maintainer handoff

## 0. Status

- Branch: `work/release-maintainer-skills-v0`
- Base: public `main` at `39bccad7fa509000bb76a9975665aa4b0f5c6fdf`
- Public release truth: immutable tag `v0.0.2`
- Repository role: source-free public distribution and integration guidance

## 1. North Star

Let a zero-context Agent select an immutable WAsmC release, write supported
source using model-prior-familiar Rust/WIT concepts, compile it through the
smallest public host path, grant only explicit imports, and prove behavior.
Keep planned/private capability visibly separate from shipped public capability.

## 2. Current Focus

Establish a minimal maintainer Skill system, then rewrite public documentation
around one canonical capability matrix and executable consumer journeys.

## 3. Recent Progress

- `v0.0.2` ships compiler Wasm, FastAPI Core 4.3, JavaScript facade, Rust
  Wasmtime demo, language guide, and five executable Agent examples.
- Live inspection confirms the public facade does not export `compileFastapi`.
- The public scalar examples pass through the shipped facade and compiler.

## 4. Current Action

Task state: started

- Objective: make release maintenance reset-safe and make public docs usable by
  a new Agent without relying on private-repository context.
- Technical basis: current documentation mixes integration, language,
  availability, and maintenance rules; current release capability is not
  summarized in one early decision surface.
- Plan: add three narrow maintainer Skills and deterministic validation; then
  revise the public Agent entrypoint, capability guide, and cross-links.
- Boundaries: no compiler/provider rebuild, no tag move, no private source or
  private path disclosure, and no claim that managed-source compilation ships.
- Validation: maintainer structure, checksums/manifest consistency, facade
  export inspection, Agent examples, Rust demo, and zero-context doc audit.
- Resume point: finish and checkpoint the maintainer scaffold, then implement
  the consumer documentation under `release-agent-docs`.

## 5. Next Actions

1. Implement the public capability matrix and first-screen Agent routing.
2. Validate both JavaScript and Rust public journeys.
3. Record the next-release FastAPI consumer closure as a maintainer-owned gap.

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
cd /Users/youxianshi/code/.worktrees/wasmcrelease/release-maintainer-skills-v0
git status --short --branch
git fetch --prune origin
./scripts/maintainer-orient.sh
```
