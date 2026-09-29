# wasmc public Agent entrypoint

This source-free compiler repository publishes a standard Core Wasm compiler,
Lib packages, a package-manager-free Runtime/Registry bootstrap, and the
public `wasmc-core-runtime` Rust SDK. This file is frozen inside the v0.0.18
product set; product presence is not lifecycle authority. Read `release.json`
only through the validated compact `agent-release-orientation.json` route for
cold-start orientation; run its named check and open the full artifact inventory
in `manifest.json` only if validation fails. Then pin its immutable tag or full
commit. Compact `release.json` is lifecycle authority, not the artifact list.

For a cold-start orientation, Lib route-release readiness, capability decision,
canonical aggregate example, telemetry state check, released Base64 selection, or Host-authority question,
read `agent-quickstart.json` once before opening broader documentation. For
release orientation it points to the 2 KB `agent-release-orientation.json`; do
not read the full `manifest.json` artifact inventory on the successful path. A
matching route is sufficient for that task: run only its named oracle when one
is provided, then stop. Do not reopen `release-surfaces.json`, scan history, or
invent a larger example merely to reconfirm the same route.

For “can we create a new release with every Lib route synchronized?”, read only
`release-lib-route-readiness.json` first. It is generated from the exact closure
and ecosystem control plane and is sufficient unless one of its two check
commands fails. Do not scan the large control plane, manifests or implementation
scripts merely to reconfirm its counts or blocker.

For “is `u64` fixed/supported now?”, use the
`producer-release-u64-delta` quickstart route. The exact producer master
implementation and the current immutable release are separate authorities:
producer commit `94328ed760f93bf24b595a71facdcc773d43b762` implements and validates
ordinary-source `u64`, while the v0.0.18 product compiler still does not contain it. `u32` already
shipped and needed no repair; `char` remains unimplemented on that producer
commit and must not be replaced by arbitrary `u32`. Lead with both authorities
in one sentence—producer master yes, v0.0.18 product compiler no—then read
`release.json` for lifecycle state, so “now” is
not answered from an unstated authority.

## Start here

Compiler source and internal compilation implementations are private. Reviewed
compiler Wasm artifacts are public; Wasmi/Wasmtime integration glue, Host
adapters, CLI, tests and cross-platform build workflows may be public. Compiler
modification permission does not grant compiler-source publication permission.

For reusable algorithms, text, bytes or collections, begin with
[the Library-first discovery Skill](skills/wasmc-lib-discovery/SKILL.md):
search → read the target Skill/WIT → approve exact identity → resolve/install
where supported → check engine/imports → verify behavior → write missing glue.
This Library-first guidance is included in the v0.0.18 product. Search is discovery, not
selection authority; approve and pin exact package identities before use.
For current-main package status, read the generated
`lib-ecosystem-control-plane.json` first. It records product inventory separately
from lifecycle state, plus actual Core imports and missing engine evidence.
LibSearch 0.4.0 covers all 21 prior roots plus itself (162 entries) and is
included in the exact v0.0.18 product and v2 candidate. Package identities are
selected from the exact `v0.0.18` catalog snapshot. Its package root is
[`standard/wasmc-lib-search/0.4.0/`](standard/wasmc-lib-search/0.4.0/). Determine
whether it is released or the public default only from `release.json` and
`channels/prod.json`.
Its current manifest binds integrated build tool `f6fc94432101250b8583834b51229bedb1cd8314`
and exact Rust toolchain fingerprint
`2e4e27cb0b3644dd0c90bb71f31de5b5c72cd47671373caab8b9146ac68bf8ca`.
Byte identity remains scoped to that fingerprint because producer commit and
Cargo.lock alone did not reproduce the historical receipt. The producer input
is `catalog/libs-v018-input.json`; admission authority is
`admission/lib-search-v040-v018-admission.json`, bound to
`catalog/libs-v018.json`.
The machine gate at `catalog/lib-route-closure.json` independently derives the
complete released package and exported WIT API inventory. Release catalog rows
and LibSearch package/API routes must equal that inventory exactly; any omitted,
extra or version-drifted binding rejects the release workflow.
The v0.0.18 closure is 22 package routes / 140 API routes with
`candidate_extras=0`. Admission alone never proves a later lifecycle stage;
read the exact channel authorities instead.

For future Host architecture work, read
[`docs/HOST_LIB_DEFINED_BOUNDARY.md`](docs/HOST_LIB_DEFINED_BOUNDARY.md).
The v0.0.18 file/network drivers remain migration evidence; they are not the
extension model. Do not add a Rust/JavaScript Host API or platform provider row
for a new system domain. Public domain semantics and their physical native
descriptors belong to exact Lib packages above one fixed boundary.

The v0.0.18 product also carries `runtime/client-foundation-v1` and
`runtime/client-foundation-gateway-v1` as one explicitly **incubating** runtime
surface. It provides a persistent WSS control loop, HTTPS content-addressed Lib
delivery, canonical serial/general-DAG composition, atomic generation replacement,
rollback, checkpoint/restart and exact cross-schema state migration above the
unchanged Host API. Product inclusion is not Lib admission: this surface is not
in the Lib catalog, not installable as a formal Lib, and does not claim general
exactly-once external effects, clustered Gateway operation, fleet scheduling or
public deployment. Read `runtime/client-foundation-v1/release-surface.json` for
the bounded status and `release.json` for the actual lifecycle stage.

For SDK/runtime/CLI/embedding integration, begin with
[the SDK discovery Skill](skills/wasmc-sdk-discovery/SKILL.md). It routes by
task intent to Core Runtime, generic Host embedding, native CLI, or lightweight
Node/Bun/Deno integration and requires exact release-surface status before code
generation. SDK discovery and Lib discovery are separate decisions.

Read [skills/wasmc-developer/SKILL.md](skills/wasmc-developer/SKILL.md)
completely. It routes only the reference needed for Runtime bootstrap,
source/WIT, Lib authoring, JavaScript, Rust/Wasmtime, or the SDK selection
Skill. Reuse Rust and WIT priors and learn only the documented wasmc delta.

## Decide status before generating code

Use the [Agent decision model](docs/AGENT_DECISION_MODEL.md) before turning
evidence into a capability claim. Qualification is evidence, not admission;
admission is necessary but not sufficient for release; release does not imply
catalog discovery or installation unless the pinned release publishes that
route. A directory, source tree, test PASS, candidate receipt, mutable branch,
or newest-looking version is never sufficient by itself.

The improvement target is controlled cold-start learning by Pi with the two
cost-controlled model routes declared in the protocol. Use
the [Fresh-Agent learning flywheel](docs/FRESH_AGENT_LEARNING_FLYWHEEL.md) and
its frozen machine protocol. One live-model PASS is diagnostic evidence only;
both declared routes must pass before claiming controlled-pair qualification.

For every answer, report the five states separately when they differ:
`qualified`, `admitted`, `released`, `discoverable`, and `installable`. Stop at
the first missing authority instead of guessing the next transition. In an
executable command, use the complete tag, commit, version and digest: never use
an ellipsis or placeholder. Exact tested engine versions are observations, not
minimum-version ranges such as `Node 22+`.

Only when `agent-quickstart.json` has no matching route: for existence,
release-status, discovery or installation questions, read
`release-surfaces.json.agent_status_queries` first. If an exact request and its
stopping condition are present, answer from that record; do not probe guessed
package paths, catalogs, examples or implementation tests to reconfirm absence.
Only when quickstart has no match: for language/type questions, first read
`release-surfaces.json.agent_capability_projection` and decide every requested
position separately. This current-main guidance is bound to v0.0.13 behavior
but was not retroactively added to the immutable tag and changes no product
bytes. Never silently narrow a numeric type or replace async, identity, ordering,
ownership or failure semantics to make a request compile.

For release orientation, the canonical aggregate-result example, released
Base64 selection, or Host-authority inspection, read
`agent-quickstart.json` first. It is a validated compact projection of
`release-surfaces.json.agent_task_routes`. A matching record is the
bounded route: stop when it answers the task, omit unrelated identities, and
never abbreviate a digest that you choose to report. Do not scan historical
catalogs, broad manifests, compatibility matrices or implementation tests to
reconfirm a complete route.

```wasmc
package local:add;
interface api {
  run: func(a: s32, b: s32) -> s32 { return a + b * 2; }
}
world app { export api; }
```

```js
import { compile, inspectWasm } from "./current/wasmc.mjs";
const bytes = await compile(source);
const inspected = inspectWasm(bytes);
if (inspected.imports.length) throw new Error("unexpected Host authority");
const instance = await WebAssembly.instantiate(inspected.module, {});
console.log(instance.exports.run(5, 6)); // 17
```

## v0.0.18 product capability contract

| Task | Status | Canonical path |
|---|---|---|
| Package-manager-free compile/self-test on Node/Deno/Bun | shipped; Node+Bun+Deno same-candidate evidenced | [runtime/README.md](runtime/README.md), `runtime/wasmc-runtime-v0` |
| Scalars, control flow, private functions, WIT values | shipped | [LANGUAGE.md](LANGUAGE.md) |
| Managed String/List/Map/record applications | shipped through matching Lib | [LIB.md](LIB.md), `instantiateLib` |
| Embedded Wasm package/API search; exact resolve and pinned install | shipped; search is not selection authority | [LibSearch](examples/lib-search/README.md), [catalog](catalog/README.md), [installation](catalog/INSTALL.md) |
| CSV, typed data, expressions, compute, relational, profile, Arrow IPC/Parquet | shipped as seven source-free v1 Libs | [release scope](docs/RELEASE_V011.md), `libs/wasmc-data-*`, `libs/wasmc-csv` |
| Router policy, JSON, gzip compression, HTTP/1 framing | shipped as four import-free portable Libs | [v0.0.18 scope](docs/RELEASE_V018.md), `libs/wasmc-router-policy`, `libs/wasmc-json`, `libs/wasmc-compression`, `libs/wasmc-http1` |
| Public third-party Lib build/publish | not closed | do not infer availability from authoring documentation |
| WIT resources, constructors, receiver methods | shipped Component profile | `libs/wasmc-resource-counter` |
| Explicit synchronous scalar Host imports | shipped; exact allowlist | `libs/wasmc-host-clock` |
| JavaScript, raw Core Wasm, Rust/Wasmtime | shipped | [HOSTING.md](HOSTING.md) |
| Wasmi-first Core execution, Wasmtime promotion, module inspection | shipped | `sdk/wasmc-core-runtime` |
| Generic Rust Host embedding, binding profiles, explicit grants | shipped | `sdk/wasmc-host` |
| System telemetry Lib | shipped for Rust Component + public Host SDK; real acquisition qualified on Linux | `libs/wasmc-system-telemetry`, `examples/system-telemetry` |
| Direct WAsmC source use of telemetry sampler resource | unsupported in v0.0.1 | rich resource-method result binding is not qualified; do not expose raw handles |
| async Libs, traits, open generics, automatic Rust API discovery | unsupported | do not invent a bridge |
| signing, auto-update, ambient filesystem/network/device access | not provided | application/publisher authority |

`release-surfaces.json` is the machine-readable SDK/runtime surface authority
for the pinned checkout. The v0.0.18 product includes `sdk/wasmc-host`; candidate or
incubating future surfaces must still be labeled honestly and must not be
described as released assets.

The v0.0.4 `dist/` and `package/` compatibility trees and the three
historical `libs/` packages remain
byte-for-byte frozen. v0.0.18 reuses the qualified compiler facades and standard
Lib1.4.0 with its matching CoreLib4.8 companion. Engine compatibility is
artifact-specific: read [compatibility/README.md](compatibility/README.md)
before treating compiler success as standard-Lib or managed Host support.

## Artifact selection

- `current/wasmc.mjs`: self-contained ESM facade.
- `current/wasmc.global.js`: current classic `globalThis.Wasmc` facade.
- `current/wasmc_compiler.wasm`: current import-free compiler Core Wasm.
- `current/index.mjs`: sidecar facade with sibling compiler and matching CoreLib.
- `standard/wasmc-std/1.4.0/`: current WIT standard Lib and generated Rust bindings.
- `standard/corelib/4.8.0/`: matching standard Lib CoreLib companion.
- `standard/wasmc-lib-search/0.4.0/`: route-complete embedded-index Lib in the v0.0.18 product. Start with [its executable guide](examples/lib-search/README.md); `node scripts/wasmc-lib.mjs search "base64"` executes this Lib. See [dev/main/prod status policy](docs/RELEASE_CHANNELS.md).
- `standard/wasmc-lib-search/0.3.0/`: historical exact LibSearch package retained
  for pinned v0.0.17 inspection; it is not the active v0.0.18 route.
- `standard/wasmc-lib-search/0.2.0/`: historical exact LibSearch package retained
  for pinned v0.0.14-v0.0.16 inspection; it is not the active v0.0.18 route.
- `standard/wasmc-lib-search/0.1.0/`: historical exact LibSearch package retained
  for pinned-version inspection; it is not the active v0.0.18 search route.
- `libs/wasmc-host-clock/`, `libs/wasmc-owned-algorithms/`, and
  `libs/wasmc-resource-counter/`: frozen historical qualification Libs.
- Other `libs/*/`: append-only admitted source-free Lib packages; never edit an
  existing released version in place.
- `libs/wasmc-system-telemetry/`: admitted surface-scoped telemetry package.
  Read its root Skill before use; Component/Rust and public Host-SDK paths are
  supported, while direct WAsmC sampler-resource source is not.
- `sdk/wasmc-core-runtime/`: public dual-engine Rust execution SDK; read its
  `SKILL.md` when present in the pinned checkout.
- `sdk/wasmc-native-compiler/`: source-free run/build/native CLI integration;
  read its `SKILL.md` and do not assume its `run` command performs Core
  Runtime SDK promotion.
- `sdk/wasmc-host/`: generic Rust Host embedding SDK **only when it exists and
  is admitted by the pinned checkout's release surface**. Its presence on a
  checkout is not automatically a release-stage claim; read `release.json`.
- `examples/rust-wasmtime/`: locked executable reference project, not an SDK.
- `runtime/wasmc-runtime-v0/`: current `compiler.wasm` plus thin universal/Node/Bun/Deno Host adapters; no npm or external JS registry.
- `runtime/registry-v0/`: repo-local resolver/channel/mirror metadata for `wasmc:runtime`.

Inspect every generated import and bind only reviewed Host functions. Never expose private handles, plans, Store nonces, lifecycle helpers, or JSON invented as a WIT replacement.

Construct CDN URLs only after reading the exact tag from `release.json`; never
substitute `main` or an unversioned URL for the pinned identity.

Verify files against `SHA256SUMS`, `manifest.json`, and `release.json`. `main`, unversioned URLs, and `package-index.json.latest` are mutable discovery state.
