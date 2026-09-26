# wasmc public Agent entrypoint

This source-free compiler repository publishes a standard Core Wasm compiler,
Lib packages, a package-manager-free Runtime/Registry bootstrap, and the
public `wasmc-core-runtime` Rust SDK. The current immutable release is
`v0.0.13`; pin that tag or its full commit for reproducible use. This release
adds the admitted system-telemetry Lib for Component/Rust + public Host-SDK
consumers while reusing the v0.0.12 compiler/runtime/SDK product bytes. See
[release scope](docs/RELEASE_V013.md).

## Start here

Compiler source and internal compilation implementations are private. Reviewed
compiler Wasm artifacts are public; Wasmi/Wasmtime integration glue, Host
adapters, CLI, tests and cross-platform build workflows may be public. Compiler
modification permission does not grant compiler-source publication permission.

For reusable algorithms, text, bytes or collections, begin with
[the Library-first discovery Skill](skills/wasmc-lib-discovery/SKILL.md):
search → read the target Skill/WIT → approve exact identity → resolve/install
where supported → check engine/imports → verify behavior → write missing glue.
This Library-first guidance remains included in v0.0.13. Search is discovery, not
selection authority; approve and pin exact package identities before use.

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

For every answer, report the five states separately when they differ:
`qualified`, `admitted`, `released`, `discoverable`, and `installable`. Stop at
the first missing authority instead of guessing the next transition. In an
executable command, use the complete tag, commit, version and digest: never use
an ellipsis or placeholder. Exact tested engine versions are observations, not
minimum-version ranges such as `Node 22+`.

For existence, release-status, discovery or installation questions, read
`release-surfaces.json.agent_status_queries` first. If an exact request and its
stopping condition are present, answer from that record; do not probe guessed
package paths, catalogs, examples or implementation tests to reconfirm absence.

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

## v0.0.13 capability contract

| Task | Status | Canonical path |
|---|---|---|
| Package-manager-free compile/self-test on Node/Deno/Bun | shipped; Node+Bun+Deno same-candidate evidenced | [runtime/README.md](runtime/README.md), `runtime/wasmc-runtime-v0` |
| Scalars, control flow, private functions, WIT values | shipped | [LANGUAGE.md](LANGUAGE.md) |
| Managed String/List/Map/record applications | shipped through matching Lib | [LIB.md](LIB.md), `instantiateLib` |
| Embedded Wasm package/API search; exact resolve and pinned install | shipped; search is not selection authority | [LibSearch](examples/lib-search/README.md), [catalog](catalog/README.md), [installation](catalog/INSTALL.md) |
| CSV, typed data, expressions, compute, relational, profile, Arrow IPC/Parquet | shipped as seven source-free v1 Libs | [release scope](docs/RELEASE_V011.md), `libs/wasmc-data-*`, `libs/wasmc-csv` |
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
for the pinned checkout. v0.0.13 publishes `sdk/wasmc-host`; candidate or
incubating future surfaces must still be labeled honestly and must not be
described as released assets.

The v0.0.4 `dist/` and `package/` compatibility trees and the three
historical `libs/` packages remain
byte-for-byte frozen. v0.0.13 reuses the qualified compiler facades and standard
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
- `standard/wasmc-lib-search/0.1.0/`: independently admitted embedded-index Lib. Start with [its executable guide](examples/lib-search/README.md); `node scripts/wasmc-lib.mjs search "base64"` executes this Lib. See [dev/main/prod status policy](docs/RELEASE_CHANNELS.md).
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
  future candidate branch is not automatically a v0.0.13 capability claim.
- `examples/rust-wasmtime/`: locked executable reference project, not an SDK.
- `runtime/wasmc-runtime-v0/`: current `compiler.wasm` plus thin universal/Node/Bun/Deno Host adapters; no npm or external JS registry.
- `runtime/registry-v0/`: repo-local resolver/channel/mirror metadata for `wasmc:runtime`.

Inspect every generated import and bind only reviewed Host functions. Never expose private handles, plans, Store nonces, lifecycle helpers, or JSON invented as a WIT replacement.

```text
https://cdn.jsdelivr.net/gh/cbgroom/wasmcrelease@v0.0.13/<PATH>
```

Verify files against `SHA256SUMS`, `manifest.json`, and `release.json`. `main`, unversioned URLs, and `package-index.json.latest` are mutable discovery state.
