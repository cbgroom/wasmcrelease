# WAsmC release maintainer bootstrap

This repository publishes source-free WAsmC packages. It is not the compiler
source or build authority. Public consumer instructions remain in `AGENTS.md`;
maintainer knowledge lives under `.agents/` and must never be shipped as a
runtime Agent skill.

## Authority chain

1. `AGENTS.md` routes public consumers and states current public capabilities.
2. `.agents/HANDOFF.md` records current repository state and the exact resume point.
3. `.agents/skills.registry.yaml` routes maintenance work to the narrow Skill.
4. `.agents/skills/**/SKILL.md` preserves release-maintainer judgment.
5. Release files and executable examples provide the observable evidence.

The private compiler repository remains authoritative for language semantics,
compiler construction, FastAPI construction, and release admission. Import
only reviewed artifacts and public facts; never copy private paths, source,
credentials, or internal implementation details here.

Public Core Host contracts, native/JS integration glue and conformance fixtures
are intentionally open standardization surfaces. Their owning judgment is
`release-host-integration`; keep low-level additions justified and reusable.
This permission does not authorize rebuilding private compiler/CoreLib products.

Compiler edits may be authorized independently in the private producer, without
authorizing any compiler-source disclosure. Wasmi/Wasmtime integration, Host
adapters, CLI and conformance/build code can remain public and consume reviewed
Wasm artifacts. Public workflows must not download or expose private compiler
source, internal source maps, source-bearing archives or private-source caches.

## Required loop

Use the local/CI split in `release-host-integration`: validate each functional
change on available local platforms, commit local checkpoints, and push coherent
milestones for broad cross-platform qualification. CI queues are not a reason to
stop safe development. Remote recovery checkpoints and release admission remain
required at their milestones, not at every small edit.

1. Read this file and `.agents/HANDOFF.md`.
2. Run `./scripts/maintainer-orient.sh`.
3. Read `.agents/skills.registry.yaml` and only the Skill(s) selected by the task.
4. Inspect the immutable release tag separately from mutable `main`.
5. Make a bounded change and stage only the intended files. If a tracked
   delivery file changed, run `node ./scripts/refresh-integrity.mjs`, review and stage
   its output, then run `./scripts/validate-maintainer.sh` plus the focused examples.
6. Update `.agents/HANDOFF.md` whenever the current truth, evidence, or next
   action changes.
7. Commit and push a coherent checkpoint. Never move an existing release tag.

## Hard boundaries

- Do not claim an API because it exists only in the private source authority.
- Do not describe a planned API as present in the public JavaScript exports.
- Do not regenerate compiler or provider bytes in this repository.
- Do not mix compiler, facade, provider, metadata, or examples across versions.
- Do not call the Rust Wasmtime example an SDK.
- Do not use `main`, `latest`, or a version range as an immutable production identity.

## Main checks

```bash
./scripts/maintainer-orient.sh
node ./scripts/refresh-integrity.mjs
./scripts/validate-maintainer.sh
node examples/agent-start/run.mjs
(cd examples/rust-wasmtime && cargo test --locked)
```
