# wasmc release channel

[![Public verification](https://github.com/cbgroom/wasmcrelease/actions/workflows/source-free-consumer.yml/badge.svg?branch=main&event=push)](https://github.com/cbgroom/wasmcrelease/actions/workflows/source-free-consumer.yml)

Source-free public packages for the private-source `wasmc` compiler.

Experimental [startup binding identity](host/completion/SCOPED_IDENTITY.md) rejects
old full references even when fresh processes recycle local IDs. The reviewed
Lib/Host driver now issues scoped references with JS WebCrypto or Native OS
randomness, rejecting entropy errors and zero output without fallback. Local
Node/Bun/Deno tests pass; exact-candidate cross-platform acceptance remains
pending. Freshness is not proved by accepting an injected nonzero identifier. Neither
the Agent API nor generated App/Lib bytes change.

Experimental [session/completion guard](host/completion/README.md) protects the
Lib/Host chain's staged read: foreign/stale/duplicate completions reject;
cancelled delivery retains the window pin until backend acknowledgement.
Cancellation does not prove an external effect was undone. Process/restart
identity and full typed guest async transport remain unqualified.

Experimental [published Lib + real Host end-to-end chain](host/lib-e2e/README.md):
real input file → bounded staging → WAsmC App → reviewed Rust algorithm Lib →
real output file + explicit sync. The same App/Lib bytes run in JS and Wasmi;
independent disk oracles cover readonly denial and trap-before-flush. This is
scheduled I/O composition, not a complete guest async ABI or production SDK.
[![Host and Lib E2E](https://github.com/cbgroom/wasmcrelease/actions/workflows/host-lib-e2e.yml/badge.svg?branch=main)](https://github.com/cbgroom/wasmcrelease/actions/workflows/host-lib-e2e.yml)
The initial [exact-source Actions run](https://github.com/cbgroom/wasmcrelease/actions/runs/34748498886)
passed all six desktop targets and fourteen JS/native pairs, twelve cases each;
[retained evidence](admission/host-lib-e2e.json) records the qualified boundary.

Next experimental Host capability: [real preopened file I/O](host/file-io/README.md).
Independent JS/Rust adapters reuse read/write/invoke-sync/release without guest
paths or certificate-specific native calls. It is not a completed Core/WIT
transport or browser filesystem adapter. The owning maintainer Skill now requires
proving an irreducible need before adding Host primitives.
[![Real Host file I/O](https://github.com/cbgroom/wasmcrelease/actions/workflows/host-file-io.yml/badge.svg?branch=main)](https://github.com/cbgroom/wasmcrelease/actions/workflows/host-file-io.yml)
Initial [six-platform exact-source run](https://github.com/cbgroom/wasmcrelease/actions/runs/34748136391)
passed all14JS/native pairs; [retained evidence](admission/host-preopened-file-v0.json)
separates real file behavior from unqualified Core transport/browser/durability.

Public experimental [Core Host v0 contract/reference](host/v0/README.md):
low-frequency evolving Native mechanisms, reusable CoreLib policy/protocols,
JS/Native semantic parity without requiring identical acceleration. Seven
bounded memory-simulator operations are implemented; twelve-operation draft,
real I/O, browser execution and typed SDK remain separate qualification gates.
[![Core Host contract](https://github.com/cbgroom/wasmcrelease/actions/workflows/thin-host.yml/badge.svg?branch=main)](https://github.com/cbgroom/wasmcrelease/actions/workflows/thin-host.yml)
Initial [exact-source run](https://github.com/cbgroom/wasmcrelease/actions/runs/34747009152)
passed all six native targets and fourteen JS/native pairs; scope and source
are retained in [prototype evidence](admission/thin-host-v0.json).

Post-v0.0.10 native packaging is in development: the public
[Wasmi-only compiler SDK/CLI](sdk/wasmc-native-compiler/README.md) embeds the
exact admitted compiler Wasm; Actions build only glue. Its six-target desktop
matrix tests Linux/macOS/Windows x64/arm64, then downloads, verifies and reruns
the same packages. This is not a new formal release, dual-engine CLI or mobile
qualification. See the workflow summaries/artifacts for the exact tested source.
[![Native compiler qualification](https://github.com/cbgroom/wasmcrelease/actions/workflows/native-compiler.yml/badge.svg?branch=main)](https://github.com/cbgroom/wasmcrelease/actions/workflows/native-compiler.yml)
Qualified implementation: [six native builds + six downloaded-consumer jobs](https://github.com/cbgroom/wasmcrelease/actions/runs/34745887997),
[complete consumer regression](https://github.com/cbgroom/wasmcrelease/actions/runs/34745902717)
and [LibSearch regression](https://github.com/cbgroom/wasmcrelease/actions/runs/34745904387).
The [retained receipt](admission/native-desktop-qualification.json) binds the
exact implementation source and six package manifest digests. Main's live badge
may be pending independently of these successful retained runs.

Post-v0.0.10 Agent guidance strengthening: start with
[Library-first discovery](skills/wasmc-lib-discovery/SKILL.md) before implementing
reusable algorithms/data operations. It teaches real search hits, exact selection,
installation and supported execution, with an executable documentation regression.
Pin this supplemental tooling commit separately; v0.0.10 products/tags stay frozen.

Current staged version: **v0.0.10**, with the [ordinary embedded-index search Lib](examples/lib-search/README.md).
The [channel policy](docs/RELEASE_CHANNELS.md) defines immutable `-dev.N` →
`-main.N` → suffix-free prod. The default prod is v0.0.10;
previous tags are immutable and prod0.0.x does not imply stable1.x.
[![LibSearch equivalence](https://github.com/cbgroom/wasmcrelease/actions/workflows/lib-search.yml/badge.svg?branch=main)](https://github.com/cbgroom/wasmcrelease/actions/workflows/lib-search.yml)

Search now runs inside the Lib's Wasm, with no runtime catalog/config input:
`node scripts/wasmc-lib.mjs search "base64 decode"`. It returns v2 typed `hits`
(packages and APIs), rather than the older v1 package-only JSON. Exact resolve/
install still use their separately pinned v0.0.9 catalog; search does not select
a version or authorize installation. The new Lib has zero imports and a portable
Core/Component value view. It is not a shared-memory/CoreLib fast ABI and does
not solve Wasmi/Node18 compatibility of the existing Std1.4.0.

Current release: `v0.0.10`, reusing compiler bytes built from exact private source
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

## Continuous verification results

The badge above is GitHub's live **main/push workflow status**, not a frozen
release certificate or source-line coverage percentage. Click it, select a run,
and open **Required aggregate verification and downloadable report** for the
exact commit, every matrix result, and case pass/fail counts. Download
`verification-report` for JSON/Markdown; `ci-*` artifacts contain individual
stdout/stderr logs, observed execution counts and tool versions, including failures.
See [complete CI scope and reproduction](docs/CI_COVERAGE.md).

Latest complete verified baseline: [21/21 suite cells, 132/132 flow checks,
18/18 SDK tests](https://github.com/cbgroom/wasmcrelease/actions/runs/34742494080),
plus [10/10 LibSearch JS cells, actual Wasmi and generated Rust SDK](https://github.com/cbgroom/wasmcrelease/actions/runs/34742493311).
The exact tested source is `a8b8adb8a3b768f32a53f9bd12938465643925d9`;
see [retained stage receipt](channels/main.json).
Later documentation receipts do not retarget that measurement; the badge above
tracks their independent main runs, which may be pending.

| Coverage dimension | Continuous checks |
|---|---|
| Host/platform | Linux + macOS; Node26.5.1, Bun1.3.14, Deno2.9.4; both HTTPS mirrors |
| Compatibility boundaries | Node18.19.1/22.0.0/26.5.1 on both platforms; probes, tampering, whole-module rejection |
| Compiler/source expression | 30 corpus outputs, 23 expression cases, 192 managed calls per full journey |
| Standard Lib | 73-API package; 5,120 representative WAsmC/Rust paired calls per execution journey |
| Catalog and installation | Four exact packages, ten resolution negatives, ten install negatives, concurrency and cleanup |
| Public deployment | Git-free archive compiler/managed/std execution; fresh GitHub Raw and jsDelivr installation |
| Runtime and Lib integration | Locked release-profile Wasmi/Wasmtime SDK tests and Rust Component/resource/Host consumer |
| Safety/integrity/Agent guidance | Complete manifests/checksums/frozen trees, all-reachable credential scan + negatives, deterministic Fresh-Agent regression |

The workflow has 21 required suite cells plus an aggregate job. Expected negative
rejections count as passing only when their assertions succeed. Failed, skipped,
missing or source-mismatched receipts fail aggregate verification; no README bot
commits, write token or third-party badge service is required. Counts describe
scoped behavior, not all 73 APIs exhaustively, every algorithm, or private compiler
source coverage. Node18 full managed/std execution is **not** supported by these
compatibility passes. Browser/device/production/performance and third-party Lib
authoring remain separate acceptance gates.

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

Consumers must pin `v0.0.10` or its full commit and verify `SHA256SUMS`.
`main` and latest metadata are mutable discovery conveniences.

## v0.0.10 testing instructions

Supplemental public [Lib discovery and exact resolver](catalog/README.md)
provides exact resolution over verified published package bytes. Search now
executes the embedded-index Lib and returns package/API hits, not installation
authority; see [the complete new Lib guide](examples/lib-search/README.md).
[Pinned download/install](catalog/INSTALL.md) now verifies the full package and
publishes without overwriting existing destinations. Third-party authoring
remains unclosed. Only the new LibSearch bytes were added; compiler/Std are reused.

Compatibility follow-up: [complete engine contract and independent Node18
reproduction](compatibility/README.md). The standard Core artifact requires
typed function references and tail calls. Original v0.0.9 does not contain the
later preflight scripts; v0.0.10 now ships them with digest-bound metadata.
Node18 is not covered by the release's passing full managed-Host matrix.

Resolve the exact current immutable commit with `git rev-parse 'v0.0.10^{}'`.
The previous v0.0.9 commit remains frozen at
`0fec38d59872a7f1527dc94799da542e968f1f8a`; no tags or its artifacts are overwritten.
This README and the [Release page](https://github.com/cbgroom/wasmcrelease/releases/tag/v0.0.10)
contain the complete handoff; no accompanying chat instructions are required.

### Download and verify

```bash
git clone --depth 1 --branch v0.0.10 https://github.com/cbgroom/wasmcrelease.git
cd wasmcrelease
```

Verify every file listed in `SHA256SUMS` before execution. On macOS use
`shasum -a 256 -c SHA256SUMS`; on Linux use `sha256sum -c SHA256SUMS`.
GitHub Raw and jsDelivr support the exact pinned release:

- [Self-contained ESM compiler](https://cdn.jsdelivr.net/gh/cbgroom/wasmcrelease@v0.0.10/current/wasmc.mjs)
- [Raw compiler Wasm](https://raw.githubusercontent.com/cbgroom/wasmcrelease/v0.0.10/current/wasmc_compiler.wasm)

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
