# WAsmC Architecture, Surfaces, Modules and Distribution

This document is the product-level map of WAsmC. The Host layering authority
remains `host/ARCHITECTURE.md` and the machine-readable Host architecture remains
`host/architecture.json`. The release-surface inventory is
`release-surfaces.json`.

The current main workstream changes the future Host extension model without
changing the immutable v0.0.15 release: all public system domains and physical
bindings move to exact Lib packages above one fixed, domain-neutral boundary.
See `docs/HOST_LIB_DEFINED_BOUNDARY.md`.

## One contract, multiple consumption surfaces

WAsmC deliberately separates the guest-visible Host contract from the way a
program is packaged or embedded.

```text
                         WAsmC ecosystem
                              |
        +---------------------+----------------------+
        |                     |                      |
        v                     v                      v
   Lib packages          Host SDK            Integrated Runtime/CLI
        |                     |                      |
        |              programmable Rust        compile/run/host
        |                     |                      |
        +-------------+-------+-------------+--------+
                      |                     |
                      v                     v
             Lightweight embedding    Native runtime library
              Node/Bun/Deno/etc.      .so/.dylib/.dll/SDK
                      |                     |
                      +----------+----------+
                                 |
                                 v
                    Portable system Libs
             VFS / process / network / devices
                                 |
                                 v
                  Platform system Libs + exact
                     native boundary descriptors
                                 |
                                 v
                       Fixed Host boundary
                Target / Resource / Window /
                     Operation / Completion
                                 |
                                 v
                    OS / service / device
```

The upper surfaces may evolve independently. They must not create parallel
guest ABIs.

For Agent consumption, release-surfaces.json is the machine-readable surface
map for the current checkout. agent_discovery.entry_skill points to
skills/wasmc-sdk-discovery/SKILL.md, and component Skills live beside the
actual SDKs. Agents select by task intent and exact release status rather than
by repository-directory existence.

## Five consumer surfaces

| Surface | Purpose | Primary public roots |
|---|---|---|
| Lib Package | Add reusable functionality without growing Host | `libs/*` |
| Host SDK | Embed and configure Host from an existing Rust process | `sdk/wasmc-host`, `sdk/wasmc-core-runtime` |
| Integrated Runtime / CLI | Open-the-box compile, run and Host integration | `runtime/wasmc-runtime-v0`, `sdk/wasmc-native-compiler` |
| Lightweight Embedding | Reuse Node/Bun/Deno/Browser runtime APIs as the OS bridge | `host/embedding/*` |
| Native Runtime Library / Platform SDK | Lowest-overhead system integration and shared native data plane | `host/runtime` + qualified drivers/platform packaging |

Libs are runtime-neutral artifacts. Rust can load the same Core/Component Libs
through Wasmi/Wasmtime that Node/Bun/Deno load through their WebAssembly
engines.

## Two Lib extension surfaces

System Lib packages define file, process, network, service and device semantics.
Their matching native boundary descriptors define platform-specific physical
calls. A new domain must not add a Rust/JavaScript Host method or provider row.

Local and remote implementations are Lib graph choices above the same boundary,
not Host capability families.

## Native and lightweight execution

Lightweight embedding intentionally uses the surrounding runtime as the OS
bridge:

```text
Guest -> system Lib -> fixed boundary -> embedding executor
      -> Node/Bun/Deno/Browser environment -> OS
```

The native high-performance path removes that extra data-plane runtime:

```text
Guest -> system Lib -> fixed boundary -> native executor -> OS
```

Both paths implement the same Host contract. Node/Bun/Deno are embedding
environments, not platform-specific guest ABIs.

## Runtime execution and cache hierarchy

Wasmi and Wasmtime/AOT are complementary lanes. The normal request path should
not synchronously wait for the optimizing compiler merely because a faster
steady-state backend may become available later.

```text
exact Wasm + Host policy identity
             |
             v
      ready fast cache?
        /          \
      yes           no
      |             |
      v             v
 Wasmtime/native   Wasmi immediate completion
      |             |
      |             +----> coalesced bounded background
      |                    Wasmtime/AOT preparation
      |                              |
      +------------------------------+
                    |
                    v
          future fresh invocation
             selects ready cache
```

The public Core Runtime SDK already implements the in-process form through
`PromotionRuntime`: synchronous Wasmi admission, a bounded asynchronous Wasmtime
compile worker, exact artifact identity, explicit candidate publication,
rollback and route selection at a fresh invocation boundary. The native
compiler separately provides a persistent target-local `.cwasm` cache keyed by
Wasm digest, Wasmtime version, target, CPU features and AOT profile. The
integrated runtime composes these mechanisms; it must not turn a cache miss into
a synchronous cold-start dependency.

The useful cache layers are:

1. **Wasmi prepared-module cache** — immediate completion/fallback for admitted
   Core Wasm.
2. **Wasmtime prepared-module cache** — in-process compiled Module/InstancePre
   used after promotion.
3. **Persistent native/AOT cache** — target-specific serialized compiled bytes,
   never portable package identity.
4. **Optional hot Store/Instance pool** — an implementation cache for workloads
   whose capability and request-isolation rules allow reuse.

The pool is therefore not a separate execution model. It is a hotter cache
layer. It may reduce instantiation cost, but it must preserve request-local Host
state, capability isolation and cleanup semantics.

While a Wasmtime/AOT compile is queued or still running, later requests may
continue using Wasmi. Once the exact candidate is complete and admitted, only
future invocations switch route. An invocation already running on one backend is
never moved mid-call; a trap or Host-side effect is never retried on the other
backend.

## Contract freeze rule

The desired steady state is a frozen, domain-neutral Host boundary with
independently evolving Lib graphs and runtime implementations. Runtime releases
may optimize reactor design, scheduling, batching, zero-copy and caches without
acquiring domain semantics.

A new guest-visible primitive is considered only when all of the following are
demonstrated with executable evidence:

1. an exact Lib plus native descriptor cannot express the required physical
   operation through existing target/resource/window/operation/completion
   mechanisms;
2. at least two independent Lib domains demonstrate the same missing mechanism;
3. the change does not move a domain operation into a universal opcode;
4. a new architecture version and unchanged-domain regression prove the new
   boundary.

## Release identity

Published surfaces share one immutable wasmcrelease identity. Product changes
enter `dev -> main -> prod` promotion and are never introduced by moving an old
tag. A release candidate binds exact product files and their digests. Public
consumer CI verifies immutable files rather than rebuilding private compiler or
Lib source authority.

The release surface inventory distinguishes published/candidate products from
incubating architecture. An incubating surface is not advertised as a completed
binary package merely because implementation code exists.

## Functional qualification

Desktop native qualification keeps six runner cells where available, with five release-required targets and one legacy optional target:

- Linux x86-64 and arm64: required
- macOS arm64: required
- Windows x86-64 and arm64: required
- macOS x86-64: legacy optional; retain coverage and history when available, but do not block release

Functionality is a hard gate. Artifact identity, Lib contracts, Host lifecycle,
resource ownership, negative cases and downloaded-consumer behavior must not be
replaced by performance measurements.

Embedding-runtime coverage is explicit rather than inferred. Node/Bun/Deno
coverage is recorded only on runner/platform combinations actually executed.
Browser/mobile/device support has its own qualification gates.

## Performance qualification

Performance is recorded where a stable workload exists. GitHub-hosted runner
families are not assumed to have equal hardware, so no cross-platform absolute
number is a release requirement.

Each platform compares only against its own recent history. Three complementary
baselines are retained: compiler/runtime (`native-cli-perf`), raw Host real-TCP
scheduling (`host-https-flywheel`), and external HTTPS service load
(`host-external-load`). The external baseline uses pinned `oha` and records
native control, WAsmC TLS/Host, and complete WAsmC service lanes at c1/c8/c32.
RPS, p99 latency and runtime prewarm are observations; a baseline difference
does not create an optimization requirement.

Performance history records exact commit, platform identity, corpus identity
and raw per-case samples. A platform with no prior history starts in bootstrap
state rather than borrowing another platform's baseline.
