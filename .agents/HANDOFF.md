# wasmc release maintainer handoff

## 0. Status

- Branch: `release/v0.0.6` public release candidate for `main`
- Release: additive `v0.0.6`; v0.0.4 compatibility trees remain frozen
- Integrated private authority: `wasmc@5081fbba5af4e4231c1231e591a22271f59487ca`
- Runtime product candidate: `2b844a141bda2aaf5843b787cd649bfca558bce9`
- Strict evidence commit: `8f6a42ba313c534e4461a765c99527339bbb6e8e`
- Existing immutable truth: `v0.0.1` through `v0.0.5` remain unchanged

## 1. North Star

Let a zero-context Agent select an immutable release, load the bundled developer or Lib Skill, reuse Rust/WIT priors, compile through the smallest public path, grant only explicit imports, and prove behavior without private-source knowledge.

## 2. Current Focus

Publish `v0.0.6` additively while mutable `main` becomes discovery state for `latest=0.0.6`. Preserve the v0.0.4 `dist/`, `package/`, and `libs/` trees byte-for-byte. Advance only Runtime/Registry, root Agent guidance, and evidence/integrity metadata.

## 3. Recent Progress

- Fresh-Agent score progressed 81 -> 91 -> 94 -> 97 -> 100/100 with findings=0.
- Current Runtime compiler is 1,487,329 bytes, SHA-256 `44b87828c2b5b01631066cf1a2bc1246534f6d97a741a111437cd39caeb884f9`.
- Runtime structured diagnostics retain compiler-owned category/range/message/fix hints and never publish failed output.
- Finite recordless managed String/List/Map roots are compiler-internal only; external pinned plans cannot populate them.
- One exact source-free Runtime archive was independently executed under Node v24.15.0, Bun 1.3.14, and Deno 2.9.6; every Host passed self-test, compile, validation, instantiation, and the same behavior oracle.
- Strict evidence rejects stale candidate commit and split source-free archive identities.
- Active public maintenance remains Python-free and npm is not required for repository-local use.

## 4. Current Action

Task state: publication authorized; candidate validation required before immutable tag creation.

- Preserve exact compatibility trees and all older tags.
- Refresh v0.0.6 manifest/provenance/SHA256SUMS only after candidate files are final.
- Require public maintainer, Fresh-Agent 100/100, Runtime, legacy scalar/Lib, and Rust/Wasmtime gates before push/tag.
- After push, verify pinned GitHub/jsDelivr bytes and run one clean pinned-tag Fresh-Agent evaluation.

## 5. Next Actions

1. Validate and commit `release/v0.0.6`.
2. Push the release branch, fast-forward public `main`, and create annotated immutable `v0.0.6`.
3. Verify GitHub Raw/jsDelivr pinned bytes and mutable latest metadata.
4. Record the published identity in the private/YXSGIT handoff.

## 6. Validation Commands

```bash
./scripts/validate-maintainer.sh
node examples/agent-start/run.mjs
(cd examples/rust-wasmtime && cargo test --locked && cargo run --locked)
```

## 7. Do Not Do

- Do not copy private compiler source or build caches.
- Do not mutate `dist/`, `package/`, or `libs/` compatibility trees in v0.0.6.
- Do not mutate or retag `v0.0.1` through `v0.0.5`.
- Do not make npm, an external JavaScript registry, or GitHub Actions a release dependency.

## 8. Recovery / Resume Commands

```bash
cd <wasmcrelease-checkout>
git status --short --branch
./scripts/maintainer-orient.sh
```
