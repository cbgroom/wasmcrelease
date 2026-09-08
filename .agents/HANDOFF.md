# wasmc release maintainer handoff

## 0. Status

- Branch: `release/v0.0.7` public release candidate for `main`
- Release: additive `v0.0.7`; v0.0.4 compatibility trees frozen
- Integrated private authority: `wasmc@d4c5c27ecce6e4bb718a7c167cf584121d9c5baf`
- Runtime product candidate: `b6659654cdbfbc4c53a5eb92ca6d67db881c0491`
- Strict evidence commit: `731de07725bc01a0d806348c5cecb3b80faa2ce3`
- Existing immutable truth: `v0.0.1` through `v0.0.6` remain unchanged

## 1. North Star

Let a zero-context Agent select an immutable release, load the bundled developer
or Lib Skill, reuse Rust/WIT priors, compile through the smallest public path,
grant only explicit imports, and prove behavior without private-source knowledge.

## 2. Current Focus

Publish `v0.0.7` additively while mutable `main` becomes discovery state for
`latest=0.0.7`. Preserve `dist/`, `package/`, and `libs/` byte-for-byte from
v0.0.4. Advance only Runtime/Registry, Agent guidance, and evidence metadata.

## 3. Release Evidence

- Runtime compiler: 1,488,174 bytes, SHA-256 `5e82679b...495119`.
- One exact source-free archive: `f48bc6f3...2d2359`.
- Node v26.5.1, Bun 1.3.14, and Deno 2.9.4 each pass self-test, compile,
  WebAssembly validation, instantiation, and `run(6,18)=42`.
- Strict Fresh-Agent: 100/100, findings=0; stale candidate and split archive
  negative gates fail closed.

## 4. Validation Commands

```bash
./scripts/validate-maintainer.sh
node examples/agent-start/run.mjs
(cd examples/rust-wasmtime && cargo test --locked && cargo run --locked)
```

## 5. Current Action

Task state: publication authorized; exact-identity candidate validation required
before immutable tag creation.

## 6. Next Actions

1. Validate and commit `release/v0.0.7`.
2. Push the release branch, fast-forward public `main`, and create annotated `v0.0.7`.
3. Verify GitHub Raw/jsDelivr pinned bytes and mutable latest metadata.
4. Record the published identity in private integrated truth.

## 7. Do Not Do

- Do not copy private compiler source or caches.
- Do not mutate frozen compatibility trees or older tags.
- Do not mutate or retag `v0.0.1` through `v0.0.6`.
- Do not make npm, an external JavaScript registry, or GitHub Actions a release dependency.

## 8. Recovery / Resume Commands

```bash
cd <wasmcrelease-checkout>
git status --short --branch
./scripts/maintainer-orient.sh
```

## 9. Completion Gate

Completion means the exact release commit is present on `release/v0.0.7`,
`main`, and annotated `v0.0.7`; integrity, public Agent, Rust/Wasmtime, strict
Fresh-Agent, frozen-tree, and pinned GitHub/jsDelivr byte checks all pass.
