# wasmc release maintainer handoff

## 0. Status

- Branch: mutable `main` after immutable `v0.0.7` publication
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

Keep immutable `v0.0.7` unchanged while mutable `main` gains source-free
consumer verification. Preserve `dist/`, `package/`, and `libs/` byte-for-byte
from v0.0.4. GitHub Actions may test published bytes but must not build or admit
canonical compiler/Lib artifacts.

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
(for runtime in node bun deno; do ./scripts/validate-source-free-runtime.sh "$runtime"; done)
(cd examples/rust-wasmtime && cargo test --locked && cargo run --locked)
```

## 5. Current Action

Task state: `v0.0.7` is published. Add continuous source-free deployment,
Node/Bun/Deno execution, JavaScript baseline, Lib-contract, and Rust/Wasmtime
behavior validation on mutable `main`.

## 6. Next Actions

1. Keep the source-free consumer workflow green on `main` and pull requests.
2. Treat failures as consumer regressions; never regenerate canonical bytes here.
3. For the next release, repeat private admission and create a new immutable tag.

## 7. Do Not Do

- Do not copy private compiler source or caches.
- Do not mutate frozen compatibility trees or older tags.
- Do not mutate or retag `v0.0.1` through `v0.0.6`.
- Do not make npm, an external JavaScript registry, or GitHub Actions a release-publication dependency.

## 8. Recovery / Resume Commands

```bash
cd <wasmcrelease-checkout>
git status --short --branch
./scripts/maintainer-orient.sh
```

## 9. Completion Gate

Completion means immutable `v0.0.7` remains unchanged and mutable `main` passes
integrity, public Agent, staged Node/Bun/Deno, Lib-contract, and Rust/Wasmtime
consumer tests without rebuilding canonical artifacts.
