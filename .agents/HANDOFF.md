# wasmc release maintainer handoff

## 0. Status

- Branch: `release/v0.0.5` public release candidate for `main`
- Release: additive `v0.0.5`; v0.0.4 compatibility trees are frozen and the new Runtime comes from private `wasmc@62e33753`
- Public tag target: the final source-free release commit
- Existing immutable truth: `v0.0.1` through `v0.0.4` remain unchanged

## 1. North Star

Let a zero-context Agent select an immutable release, load the bundled developer or Lib Skill, reuse Rust/WIT priors, compile through the smallest public path, grant only explicit imports, and prove behavior without private-source knowledge.

## 2. Current Focus

Publish `v0.0.5` additively while mutable `main` becomes the discovery surface for `latest=0.0.5`. The source-free release preserves the v0.0.4 `dist/`, `package/`, and `libs/` trees byte-for-byte and adds the Python-free/no-npm Runtime/Registry package from private `wasmc@62e33753`.

## 3. Recent Progress

- Compatibility source is immutable public `v0.0.4@573dda3b`; its `dist`, `package`, and `libs` Git trees are frozen.
- The new Runtime is exact private `wasmc@62e33753f8c89ebba353f974c47beafac7921997`, compiler 1,484,773 bytes SHA-256 `c96ee185...bcbd3b`.
- Runtime Node/Deno receipts are present; Node self-test and compile are re-run in the public candidate. Bun remains adapter-only evidence on this publisher host.
- Public maintainer integrity/orientation is migrated from Python to Node; active `.py` files are zero.

## 4. Current Action

Task state: publication-ready after candidate validation

- Result: `v0.0.5` candidate is additive: byte-frozen v0.0.4 compatibility plus the new source-free Runtime/Registry and Python-free public maintenance path.
- Evidence: validate-maintainer, legacy Agent scalar/managed journeys, Runtime Node self-test/compile, checksum/manifest/receipt checks, and compatibility-tree immutability are required before tag.
- Residual risk: Bun live-runtime evidence and CDN propagation remain external post-push evidence; `v0.0.5` remains `stable=false`.
- Next action: validate, commit, push `release/v0.0.5`, fast-forward public `main`, tag immutable `v0.0.5`, then perform a clean new-Agent pinned-tag evaluation.

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
- Do not mutate or retag `v0.0.1` through `v0.0.4`.
- Do not call the Rust demo an SDK or make GitHub Actions a release dependency.

## 8. Recovery / Resume Commands

```bash
cd <wasmcrelease-checkout>
git status --short --branch
./scripts/maintainer-orient.sh
```
