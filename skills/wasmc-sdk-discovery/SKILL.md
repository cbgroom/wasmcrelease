---
name: wasmc-sdk-discovery
description: Select the correct public WAsmC SDK, runtime, CLI, or embedding surface for an integration task. Use before writing integration glue; do not use for Lib/package discovery.
---

# WAsmC SDK discovery

Use this Skill when the question is **how to integrate or execute WAsmC**, not
which reusable algorithm/data Lib to load. Lib selection remains owned by
`wasmc-lib-discovery`.

## Establish exact product state first

1. Pin an immutable Git tag or full commit before production use.
2. Read `release.json` from that pinned checkout.
3. If `release-surfaces.json` exists, use its status for SDK/runtime surfaces.
   A directory existing on mutable `main` or a feature branch does not make it
   part of an older immutable release.
4. Read the component Skill below before generating code.

## Task router

| Intent | Select | Component Skill |
|---|---|---|
| Existing Rust process needs Core Wasm execution, import inspection, Wasmi-first completion, bounded async Wasmtime preparation, promotion/rollback | `wasmc-core-runtime` | `sdk/wasmc-core-runtime/SKILL.md` |
| Existing Rust process also needs generic Host resources, platform binding profiles, explicit grants, and an auditable binding report | `wasmc-host` | `sdk/wasmc-host/SKILL.md` |
| User wants the source-free CLI to compile/run an import-free scalar App or emit a target-local native executable | native compiler/CLI | `sdk/wasmc-native-compiler/SKILL.md` |
| Node/Bun/Deno project wants a lightweight Host and can use the surrounding runtime as the OS bridge | lightweight embedding | `host/embedding/node`, `host/embedding/bun`, or `host/embedding/deno` |
| Application wants a prebuilt `.so/.dylib/.dll` native WAsmC runtime | native runtime library | use only when the pinned release surface is actually published and contains that package; never invent one from `host/runtime` source |
| Reusable algorithm/data capability | **not an SDK task** | return to `skills/wasmc-lib-discovery/SKILL.md` |

## Selection rules

- Prefer the smallest surface that satisfies the task.
- `wasmc-core-runtime` owns engine mechanics. The embedding application still
  owns WIT/profile admission, capability policy, persistence, deployment, and
  business routing.
- `wasmc-host` adds Host-side resource registration and binding policy; its
  Minimal/Safe/Development profiles are **authority presets**, not guest
  execution-limit profiles.
- The current native CLI `wasmc run` is a Wasmi path for its documented
  import-free App scope. Do not silently replace it with the Core Runtime SDK's
  promotion model.
- Node/Bun/Deno lightweight embeddings and native Rust Host embedding implement
  the same Host contract through different physical OS bridges. Do not expose
  runtime-specific objects as guest resource identity.
- A candidate/incubating surface is not a production release asset. State the
  status and stop rather than fabricating an install command.

## Typical requests

- “I already have a Rust service and only need to execute reviewed Core Wasm
  with limits.” → `wasmc-core-runtime`.
- “My Rust service also needs files/memory/platform resources and I want WAsmC
  to bind them.” → `wasmc-host`, but only if the pinned surface admits it.
- “Compile this source, run the supported scalar App, or make a native
  executable.” → native CLI.
- “Keep my Node/Bun/Deno project lightweight; do not add the Rust native
  runtime.” → lightweight embedding through that runtime's OS APIs.
- “Give me the prebuilt WAsmC shared library.” → check native-runtime-library
  status; if incubating, report unavailable rather than inventing a package.
- “I need CSV/join/compression/algorithm capability.” → this is a Lib-discovery
  task, not an SDK selection task.

## Completion evidence

For the selected surface, report:

- immutable release tag/full commit;
- exact component path and status;
- command/test actually run;
- Host imports or granted selectors;
- configured execution/resource limits;
- untested platform or packaging scope.
