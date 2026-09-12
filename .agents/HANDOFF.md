# wasmc release maintainer handoff

## 0. Status

- Branch: `release/v0.0.8-candidate` from current public `main`
- Release: additive `v0.0.8` candidate; v0.0.4 compatibility trees frozen
- Integrated private SDK authority: `wasmc@bddf8a371698ac7f1ced87b02952df5be5359dad`
- Runtime product candidate: `b6659654cdbfbc4c53a5eb92ca6d67db881c0491`
- Strict evidence runner/SDK authority: `bddf8a371698ac7f1ced87b02952df5be5359dad`
- Existing immutable truth: `v0.0.1` through `v0.0.7` remain unchanged

## 1. North Star

Let a zero-context Agent select an immutable release, load the bundled developer
or Lib Skill, reuse Rust/WIT priors, compile through the smallest public path,
grant only explicit imports, and prove behavior without private-source knowledge.

## 2. Current Focus

Task state: active — user authorized the narrow encoded-artifact false-positive
repair on 2026-09-13. Public latest remains immutable v0.0.8. Preserve raw and
authorized receipts in admission/credential-scan-v009-*.json: raw findings are
not erased. Only two exact historical compiler carrier blobs can qualify,
after exact decoded compiler digest, canonical Base64, import-free Wasm and
all-nine-detector decoded-byte proof. Unknown carriers and deleted historical
credentials reject; scripts/test-credential-scan.mjs passes these negatives.
The earlier aa00 private compiler candidate passed all 90 distribution outputs,
23 expression cases per Host and 192 managed-loop calls per Host; it is now
superseded by newer private main. Rebuild that exact latest clean source and
repeat qualification before immutable v0.0.9 tag or main promotion. Unstaged
artifacts are unfinished. No MCPGit release/deployment is in scope.

Publish the engine-neutral `wasmc-core-runtime` Rust SDK without rebuilding the
Runtime compiler or frozen compatibility artifacts. Preserve `dist/`,
`package/`, and `libs/` byte-for-byte from v0.0.4. GitHub Actions may test
published bytes and SDK source but must not build or admit canonical
compiler/Lib artifacts.

## 3. Release Evidence

- Runtime compiler: 1,488,174 bytes, SHA-256 `5e82679b...495119`.
- One exact source-free archive: `f48bc6f3...2d2359`.
- Node v26.5.1, Bun 1.3.14, and Deno 2.9.4 each pass self-test, compile,
  WebAssembly validation, instantiation, and `run(6,18)=42`.
- Strict Fresh-Agent: 100/100, findings=0; stale candidate and split archive
  negative gates fail closed.
- Public Core Runtime SDK: 18/18 tests pass with Wasmi and Wasmtime enabled;
  module inspection remains independent of synchronous Wasmtime compilation.

## 4. Validation Commands

```bash
./scripts/validate-maintainer.sh
cargo test --locked -p wasmc-core-runtime
node examples/agent-start/run.mjs
(for runtime in node bun deno; do ./scripts/validate-source-free-runtime.sh "$runtime"; done)
(cd examples/rust-wasmtime && cargo test --locked && cargo run --locked)
```

## 5. Current Action

Task state: exact `v0.0.8` candidate is assembled and locally verified. Finish
the high-confidence reachable-blob scan, commit and push the immutable release
branch/tag, verify Raw/jsDelivr bytes, then advance mutable `main`.

## 6. Next Actions

1. Run the final public-history and reachable-blob scan immediately before publication.
2. Publish the exact candidate through a new immutable `v0.0.8` tag without moving older tags.
3. Verify fresh GitHub Raw/jsDelivr and Git-consumer SDK use, then advance `main`.

## 7. Do Not Do

- Do not copy private compiler source or caches.
- Do not mutate frozen compatibility trees or older tags.
- Do not mutate or retag `v0.0.1` through `v0.0.7`.
- Do not make npm, an external JavaScript registry, or GitHub Actions a release-publication dependency.

## 8. Recovery / Resume Commands

```bash
cd <wasmcrelease-checkout>
git status --short --branch
./scripts/maintainer-orient.sh
```

## 9. Completion Gate

Completion means immutable `v0.0.8` and mutable `main` resolve to the admitted
candidate, older tags remain unchanged, Raw/jsDelivr bytes match, and public
Agent, staged Node/Bun/Deno, Lib, Rust/Wasmtime, and Core Runtime SDK consumer
tests pass without rebuilding canonical compiler/Lib artifacts.
