# WAsmC0.0.21

WAsmC compiles WIT-shaped application source to standard Core Wasm. This
source-free distribution combines one compiler, Provider4.9, Std1.4.1,
LibSearch0.5.0,42 complete current Lib identities and public Rust/Host SDKs.
Compiler implementation source stays private.

Start with [AGENTS.md](AGENTS.md) or [agent-quickstart.json](agent-quickstart.json).
Read [agent-release-orientation.json](agent-release-orientation.json) and run its
check for the published immutable identity. `release.json` and channel files
own lifecycle; product presence does not establish a released stage. Pin an
immutable tag or full commit before constructing CDN URLs.

The product permits non-commercial research only. Read [LICENSE](LICENSE) and
[license-policy.json](license-policy.json); commercial and production use
require a separate written license. Original third-party notices accompany
complete Roots and Native packages. Earlier immutable grants remain unchanged.

## Compiler and embedding

Use `current/wasmc.mjs` for ESM, `current/wasmc.global.js` for classic scripts,
or `current/wasmc_compiler.wasm` for raw Core. The Runtime/Registry bootstrap
carries the same compiler. The authority is
[current/compiler-release.json](current/compiler-release.json).

```sh
node scripts/current-compiler-integrity.mjs --require-qualification
node scripts/test-current-compiler.mjs
node examples/current/standard.mjs
```

Node, Bun and Deno consumer checks are separate evidence. The Native CLI runs
with Wasmi2.0.0; explicit AOT uses Wasmtime49.0.2. Native packages bind their
source commit, compiler, target, executable, lockfile and original licenses.
Linuxx64/Linuxarm64/macOSarm64/Windowsx64/Windowsarm64 are required targets;
macOSIntel is an additional observed target. Cross-compilation alone does not
establish downloaded-consumer execution.

## Library-first selection

Follow [Library-first discovery](skills/wasmc-lib-discovery/SKILL.md).
The pinned catalog owns complete Roots, WIT, SDK views and dependency notices.
Its42 package routes and236 API routes give278 exact search entries.

```sh
node scripts/wasmc-lib.mjs search "base64 decode" --catalog-sha256 a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad --limit 8
node examples/base64/run.mjs
```

Search discovers candidates; resolve verifies the exact catalog, manifest and
Root inventory. Installation uses a separately pinned lock and no-clobber
destination. Read each Root's Skill, WIT and declared profile before using it.
Fourteen native-source rows are source-only. They do not imply executable or
physical-device qualification.

[Std1.4.1](standard/wasmc-std/1.4.1/) retains73 operations and nine resources
with complete generated Core and Component Rust SDKs. Its Core import requires
Provider4.9. [LibSearch0.5.0](standard/wasmc-lib-search/0.5.0/) implements the
bounded full-index lookup and search. The matching Provider is
`current/lib_core.wasm`.

## Language and external effects

Read [LANGUAGE.md](LANGUAGE.md), [LIB.md](LIB.md) and
[HOSTING.md](HOSTING.md). Ordinary-source `u64` is supported; `char`, ordinary
async source and a direct public Map result remain independently unsupported.
Resident/local managed values and public Component values have distinct
contracts. Use manifest-owned SDK paths and explicit ownership/cleanup.

Inspect every import and compare it with an application-owned exact allowlist
before instantiation. Imports request effects; installation supplies no Host
capability. System Telemetry supports its declared Component resource view;
ordinary-source direct resource methods remain unsupported. Client Foundation
and Gateway remain incubating.

The [0.0.21 release evidence](docs/RELEASE_V021.md) keeps source, artifact,
runtime, Native platform, whole-candidate and lifecycle gates separate.
