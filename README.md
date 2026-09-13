# wasmc release channel

Source-free public packages for the private-source `wasmc` compiler.

Current release: `v0.0.9`, built from exact private source
`e69abb73f667f3810b0c40937fd1a1e2d04d4255`. Use `current/` for the
latest compiler facade; `dist/`, `package/`, and `libs/` are frozen v0.0.4
compatibility trees, not current compiler entrances. The Wasmi/Wasmtime
Core Runtime SDK remains available in `sdk/wasmc-core-runtime`.

This release covers bit operations, managed collection loops, stable minimal
String paths, and the 73-function `wasmc:std@1.4.0` source-free standard Lib.
The standard Lib is reused from its qualified producer, not rebuilt here.
See [current examples](examples/current/standard.wasmc) and run
`node scripts/validate-current.mjs` and `node examples/current/standard.mjs`
(Bun and Deno are also supported). These deterministic tests are not the
original external 114-entry evaluation or a fresh LLM-generated benchmark.

GitHub Actions continuously exercises the public repository as a source-free consumer: staged deployment, Node/Bun/Deno compile and execution, JavaScript examples, Lib package contracts, and Rust/Wasmtime Component behavior. It does not build, replace, or admit canonical compiler/Lib bytes; immutable release publication remains a separate maintainer-controlled process.

- Agents and developers: [AGENTS.md](AGENTS.md)
- Language delta: [LANGUAGE.md](LANGUAGE.md)
- Lib model and managed collections: [LIB.md](LIB.md)
- JavaScript, raw Wasm, and Wasmtime: [HOSTING.md](HOSTING.md)
- Runtime/Registry bootstrap: [runtime/README.md](runtime/README.md)
- Wasmi + Wasmtime Core Runtime SDK: [sdk/wasmc-core-runtime/README.md](sdk/wasmc-core-runtime/README.md)
- Release history: [RELEASES.md](RELEASES.md)

## JavaScript context

A checked-out source-free release uses the checked-in facade directly:

```js
import { compile, inspectWasm } from "./current/wasmc.mjs";
```

Only an application that has explicitly installed or resolved the package uses:

```js
import { compile, inspectWasm } from "@wasmc/compiler";
```

These are explicit contexts, not fallback probes. Repository-local use does not require npm or another external JavaScript registry.

Consumers must pin `v0.0.9` or its full commit and verify `SHA256SUMS`.
`main` and latest metadata are mutable discovery conveniences.

## v0.0.9 testing instructions

Supplemental public [Lib discovery and exact resolver](catalog/README.md)
provides offline `search → resolve` over verified published package bytes.
It lives on later main commits, not the immutable v0.0.9 tag. Installation and
third-party authoring remain separate next stages; no new binaries are implied.

Compatibility follow-up: [complete engine contract and independent Node18
reproduction](compatibility/README.md). The standard Core artifact requires
typed function references and tail calls. Original v0.0.9 does not contain the
later preflight scripts; use an exact pinned follow-up main commit for them.
Node18 is not covered by the release's passing full managed-Host matrix.

Publication is complete. The immutable release commit is
`0fec38d59872a7f1527dc94799da542e968f1f8a`.
Documentation-only additions on `main` do not change that tag or its artifacts.
This README and the [Release page](https://github.com/cbgroom/wasmcrelease/releases/tag/v0.0.9)
contain the complete handoff; no accompanying chat instructions are required.

### Download and verify

```bash
git clone --depth 1 --branch v0.0.9 https://github.com/cbgroom/wasmcrelease.git
cd wasmcrelease
```

Verify every file listed in `SHA256SUMS` before execution. On macOS use
`shasum -a 256 -c SHA256SUMS`; on Linux use `sha256sum -c SHA256SUMS`.
GitHub Raw and jsDelivr support the exact pinned release:

- [Self-contained ESM compiler](https://cdn.jsdelivr.net/gh/cbgroom/wasmcrelease@v0.0.9/current/wasmc.mjs)
- [Raw compiler Wasm](https://raw.githubusercontent.com/cbgroom/wasmcrelease/v0.0.9/current/wasmc_compiler.wasm)

Use `current/wasmc.mjs` for the self-contained ESM path or `current/index.mjs`
for the sidecar package path. The latter needs its sibling compiler and Lib
files. `current/wasmc.global.js` is the classic-script carrier.
Do not test the latest compiler through `dist/`, `package/`, or `libs/`:
those directories are frozen historical compatibility artifacts.

### Run the published regressions

```bash
node scripts/validate-current.mjs
node examples/current/standard.mjs

bun scripts/validate-current.mjs
bun examples/current/standard.mjs

deno run --allow-read --allow-write --allow-run --allow-env scripts/validate-current.mjs
deno run --allow-read examples/current/standard.mjs

cargo test --locked -p wasmc-core-runtime
cd examples/rust-wasmtime
cargo test --locked
cargo run --locked
```

Deno permissions above belong to the test harness (file outputs and CLI child
processes), not an implicit grant of authority to compiled applications.
Rust commands build the public consumer/SDK, not the private compiler.

### What is shipped and what passed

The compiler is 1,351,666 bytes, has zero Host imports, and its SHA-256 is
`93d946c544975a6e7642ff1f5890e09d3bfb9924d0256ffcfebcf07485597c90`.
Each JS Host passed 30 frozen-corpus outputs across the public API/CLI carriers,
23 reconstructed expression cases (including intentional rejections), and
192 repeated managed-collection loop calls. Each also passed 5,120 paired
WAsmC/Rust caller checks against the same standard Lib. These paired checks
are representative behavior checks, not exhaustive coverage of all 73 APIs.

The strict `wasmc:std@1.4.0` package is in `standard/wasmc-std/1.4.0`, with WIT,
Core/Component artifacts and generated Rust SDK. Its 4.8 CoreLib companion is
in `standard/corelib/4.8.0`; follow the complete Host reference
`examples/current/standard.mjs`. Automatic managed-source compilation retains
its matching 4.3 provider in `current/lib_core.wasm`. These providers are not
interchangeable; do not replace one merely because another has a newer version.
Application authors use ordinary typed APIs, not provider-private handles.

Public Wasmi/Wasmtime SDK tests passed 18/18. The actual Wasmtime compiler,
resource Lib and authorized Host Lib journey passed (`scalar=17`, `resource=15`,
`host=42`). Pinned GitHub Raw/jsDelivr bytes matched, and the full fresh public
download passed checksums and JS compiler/standard-Lib tests on all three Hosts.
[GitHub Actions](https://github.com/cbgroom/wasmcrelease/actions/runs/34726851005)
passed all five jobs for the exact release commit.

See [qualification](admission/qualification-v009.json),
[compiler provenance](admission/compiler-build-v009.json),
[same-archive Host evidence](admission/runtime-local-host-evidence-v009.json),
and [release history](RELEASES.md) for detailed evidence.

### Boundaries and reporting failures

This is a testing release of an Agent-first execution language, not full Rust
or proof of universal expression coverage. Raw pointers, complex generics,
arbitrary async control flow and automatic cross-domain managed transport are
not promised. Browser execution was not validated in this release campaign.
The 23 cases are not the original external 114-entry corpus; deterministic
Fresh-Agent harness scoring is not a new LLM-generation benchmark. Standard
Lib bytes were reused from their qualified producer, not rebuilt for publication.
No MCPGit release, deployment or production activation is included.

Historical credential-scan raw hits were retained, not hidden. Under explicit
authorization, only two exact frozen compiler Base64 carriers were classified
after digest, canonical encoding, import-free Wasm and decoded-byte detector
proof. Zero unresolved findings/skips/errors and deleted-credential/unknown-carrier
negative tests passed; this is not an exhaustive secret-free claim. Raw and
classified receipts are in `admission/credential-scan-v009-*.json`.

For a failure, report the pinned tag/commit, Host/tool versions, minimal source,
the exact compile or link command, structured diagnostic, explicit imports,
inputs and expected/actual output. Distinguish compile failure, activation/link
failure and runtime mismatch; do not treat a WIT signature alone as physical
JS FFI support. Read `LANGUAGE.md`, `LIB.md`, `HOSTING.md` and the bundled
developer Skill before concluding that an unsupported source form is a bug.
