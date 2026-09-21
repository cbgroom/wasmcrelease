# Release surfaces and qualification

The canonical machine-readable inventory is `release-surfaces.json`. This
document explains how its surfaces enter a WAsmC release.

## Release units

Five consumer surfaces are recognized: Lib Package, Host SDK, Integrated
Runtime/CLI, Lightweight Embedding and Native Runtime Library/Platform SDK.
Driver/Provider and Remote Provider are extension surfaces behind the same Host
contract.

Not every surface must be at the same maturity. `published` and `candidate`
surfaces participate in release identity and required qualification.
`qualified-reference` surfaces are public integration references with executable
coverage but are not claimed as standalone binary SDKs. `incubating` and
`architecture` surfaces must not be promoted by documentation alone.

## Agent discovery and component maturity

Agents start at `AGENTS.md` and route SDK/runtime/CLI tasks through
`skills/wasmc-sdk-discovery/SKILL.md`. The machine-readable mapping is
`release-surfaces.json.agent_discovery`; component Skills live beside the
actual SDK source. A directory existing in a mutable checkout is not sufficient
evidence that an older immutable tag shipped it.

| Component | Current checkout status | Agent Skill | Important boundary |
|---|---|---|---|
| Core Runtime SDK | published; immutable v0.0.11 example | `sdk/wasmc-core-runtime/SKILL.md` | engine mechanics; Host/business admission remains embedding-owned |
| Generic Host SDK | candidate | `sdk/wasmc-host/SKILL.md` | not part of immutable v0.0.11 |
| Native CLI source surface | published | `sdk/wasmc-native-compiler/SKILL.md` | CI/development native packages are not immutable release assets |
| Lightweight embedding | qualified-reference | SDK discovery routes to `host/embedding/*` | surrounding runtime is the physical OS bridge |
| Native Runtime Library | incubating | no install Skill yet | do not invent a `.so/.dylib/.dll` package |

The `SDK Agent guidance` workflow verifies that these routes resolve to real
public API names and executes the Core Runtime, Host SDK, and native CLI
behavior tests. Cross-platform product behavior remains qualified by the
surface-specific workflows; this guidance workflow does not replace them.

| Surface | Current status | Functional Actions | Performance |
|---|---|---|---|
| Lib Package | published | source-free-consumer, host-lib-e2e | workload-specific |
| Host SDK | candidate | rust-host-sdk, source-free-consumer, host-lib-e2e | not yet a release gate |
| Integrated Runtime / CLI | published | native-compiler, source-free-consumer | native-cli-perf |
| Lightweight Embedding | qualified-reference | source-free-consumer, host-lib-e2e | runtime-specific observations |
| Native Runtime Library / Platform SDK | incubating | thin-host, host-lib-e2e, host-network, host-file-io | host-https-flywheel + host-external-load |
| Driver / Provider | qualified-reference | host-lib-e2e, host-network, host-file-io, host-memory | driver-specific |
| Remote Provider | architecture | not yet a release product | none |

## Required functional evidence

Every published/candidate surface names the workflows that qualify it. The
combined desktop matrix is:

| Platform ID | GitHub runner | Release gate |
|---|---|---|
| linux-x86_64 | ubuntu-24.04 | required |
| linux-aarch64 | ubuntu-24.04-arm | required |
| macos-x86_64 | macos-15-intel | legacy optional |
| macos-aarch64 | macos-14 | required |
| windows-x86_64 | windows-2025 | required |
| windows-aarch64 | windows-11-arm | required |

Native Runtime/Host behavior keeps six-platform coverage when runners are available, but only five desktop targets are release-required. macOS x86-64 is legacy optional: it continues to run and contribute evidence when available, but its failure does not block release.
The Native CLI/package workflow builds and re-consumes packages on the same six
platform identities. The Rust Host SDK workflow uses the same six runner cells.
Lib identity/Component behavior and Node/Bun/Deno lightweight embedding are
covered by the source-free and Host/Lib workflows according to their explicit
runtime support.

Feature branches and pull requests validate the development release-surface
model and candidate policy without rewriting the currently published immutable
release manifest. On `main`, the Host composition workflow additionally runs
the published-release integrity gate. A future release promotion refreshes
integrity metadata only for the new immutable candidate; old tags remain
unchanged.

## Performance baseline

Performance is intentionally split by layer:

- `native-cli-perf.yml`: compile, native cache miss/hit, Wasmi run and native run;
- `host-https-flywheel.yml`: raw real-TCP Host lifecycle/reactor scheduling;
- `host-external-load.yml`: external-client service baseline using pinned
  `oha 1.16.0` against real TLS sockets, with native control, WAsmC TLS/Host,
  and complete WAsmC service lanes.

The external load contract is machine-readable in
`bench/host-external-load.json`: c1/c8/c32, 3-second windows, two samples,
five required desktop platforms and legacy-optional Intel macOS coverage. These
baselines never compare one platform's absolute timing against another.

For each metric and platform, the aggregator looks at the most recent
same-platform observations (bounded by `bench/manifest.json`), computes their
median and emits:

```text
relative_ratio = current_value / same_platform_baseline
```

For latency metrics lower is better. Missing history produces `bootstrap`. The
configured advisory ratio highlights regressions without turning normal
GitHub-hosted runner variance into a false functional failure. A future metric
may become a hard gate only after its own history demonstrates that a stable
threshold is justified.

Performance evidence is not an optimization mandate. The purpose of the
baseline is to make later changes measurable. A slower observation may be
accepted intentionally when functionality, compatibility, memory, portability
or maintainability has higher priority.

## Promotion

The release promotion sequence remains `dev -> main -> prod`. New product bytes
start a new dev candidate. Promotion reuses the exact product digests; it does
not rebuild them. The next release candidate created by
`scripts/release-candidate.mjs` includes the public Host contract/architecture,
Rust Host SDK dependencies and these release-surface documents in addition to
the existing compiler/runtime/Lib inventory.
