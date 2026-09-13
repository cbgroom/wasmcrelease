---
name: release-host-integration
description: Maintain wasmc JavaScript, raw Core Wasm, Lib Component, Rust, and Wasmtime integration guidance with exact imports, lifecycle, version, and behavior evidence.
---

# Release Host integration

## Compiler protection and open engine integration

Compiler source and internal compilation implementations remain private. Permission
to modify the compiler is not permission to publish its source. Public delivery
may contain the reviewed compiler Wasm, Wasmi/Wasmtime integration source, Host
adapters, CLI, conformance tests and cross-platform build workflows. Public CI
consumes admitted compiler/Lib artifacts; it does not fetch private compiler
source or embed it in caches, logs, source maps or build archives.

An engine rejecting a standard Lib is not evidence that the compiler must change.
Inspect the exact failing artifact, its producer, generated bindings and linking/
optimization feature settings first. Prefer a compatible Lib build behind the
same WIT/API. Change private compiler code only for an independently reproduced
compiler defect or missing generic mechanism; retain separate source-bound
qualification. Engine glue itself requires no compiler disclosure.

## Local-first iteration, milestone cross-platform qualification

Use available local platforms for the fast functional loop: focused regression,
actual App/Lib/Host execution, error/lifecycle tests and relevant Rust checks.
Commit reproducible local checkpoints; batch small verified improvements into a
coherent milestone before pushing for GitHub Actions. Do not push every edit or
wait for a queued/running workflow before continuing safe local development.
Keep independent workstreams isolated when they overlap an in-flight candidate.

Actions qualify broad OS/architecture/engine coverage against an exact commit,
not the changing worktree. Old-source PASS never qualifies newer product code;
submit the next milestone independently. Label local PASS, cross-platform PASS,
main integration and immutable release separately. Preserve actual failure
receipts and fix regressions locally; do not disable gates, skip required cells
or relax safety to accelerate iteration. Cross-platform acceptance and formal
release still require their relevant exact-candidate evidence. Report progress
with explicit denominators; local validation completion is not ecosystem closure.

## Minimal, low-frequency evolving Host

Core Host mechanisms aim to support a broad CoreLib ecosystem without native
updates per feature. Stable means low-frequency justified evolution, not an
immutable Host forever. The twelve-operation v0 list is a draft to compress and
validate, not an approved minimum or a requirement every platform implements it.

Before proposing a Host primitive, establish why existing CoreLib cannot do it,
then why existing I/O/capability primitives plus a platform Lib cannot do it.
Only an irreducible external mechanism or evidenced security/correctness/
performance need justifies addition. Record the reusable capability family,
affected platform adapters, compatibility negotiation and executable evidence.
Moving business-specific operations into a universal opcode is not reduction.

Example: certificate bytes exposed as files need restricted file I/O plus a
platform-location/format Lib, not a new certificate-loading Host syscall.
Trust-root selection is explicit policy, not permission to read arbitrary
files. Platform services or non-exportable keys may require optional adapters;
do not turn these into mandatory primitives on every platform. TLS protocol,
certificate parsing, codecs, algorithms and retry/cache/scheduling policy belong
in CoreLib. Network transport, trustworthy time, secure entropy and actual
hardware effects remain explicit Host dependencies. Pure Rust alone proves
neither Wasm portability nor production cryptographic qualification.

Borrow the endpoint/read/write/wait/release reuse principle of Unix without
forcing datagrams, storage durability or devices into identical stream semantics.
Capability/permission, completion, cancellation and ownership semantics should
be shared between JS and Native; low-copy windows/batch/ring are optional
acceleration. Browser restrictions must not cap Native, and missing capabilities
must reject explicitly rather than silently simulate different effects.

Public Host contract/glue may be maintained here; compiler and CoreLib producer
authority is unchanged. Read [v0 profile](../../../host/v0/README.md) for exact
implemented/draft gaps. Prioritize real CLI/file I/O, TCP/UDP and resident service
validation using existing mechanisms; do not call simulator success real I/O,
typed WIT draft a physical adapter, or native build proof browser/mobile support.

## Integration layers

- JavaScript facade is the default Node/browser-family consumer path.
- Raw compiler Core Wasm is the portable ABI path for other hosts.
- The Rust project is executable Wasmtime reference code, not an SDK crate.
- `lib_core.wasm` is the matching managed-value Core provider; standalone Libs
  additionally publish WIT-authoritative Core and Component views.

Choose the smallest layer that satisfies the caller. Do not add a wrapper when
copyable reference code exposes the contract more clearly.

## Host authority and lifecycle

Real asynchronous I/O cancellation suppresses delivery, not already-issued
external effects. Keep window ownership pinned until backend completion proves
it has stopped accessing the window; a late completion may drain but must not
publish cancelled bytes or replay an effect. Never force-release on timeout
without safely terminating/quarantining the backend. Revocation must deny new
grants/delivery while still permitting drain and cleanup. Qualify malformed,
foreign/stale/duplicate completions and terminal-record quotas with independent
state/resource oracles. Read [completion guard](../../../host/completion/README.md)
when extending the public prototype; its single-registry process-local identity
is not restart-safe or a completed typed Core ABI. Serialized trace success is
not OS concurrency/fault proof. Simulator cancel guarantees remain narrower.

- Inspect every generated program import and bind only explicitly authorized functions.
- Compiler adapter buffers are instance-local mutable state; use exclusive
  access, copy results before clear, and clear on success and failure.
- Reuse Wasmtime Engine/Module compilation where appropriate, but use a fresh
  bounded Store for independent requests.
- Keep compiler, Libs, metadata, and facade from one release identity.
- Treat Wasmtime serialized modules as target/toolchain/configuration caches,
  never as the portable package identity.

## Evidence

Diagnose feature incompatibility from complete artifact validation and minimal
executable probes, not target_features metadata or the first byte-offset error.
Bind contracts to exact artifact digests; distinguish Core capabilities from
JavaScript Host globals. Tested exact engines are not minimum-version guarantees.
Check identity and engine support before instantiation; probe success never
replaces full-module validation. Follow-up tooling must not pretend it was
shipped inside an older immutable tag or alter strict Lib root inventories.

Validate the actual public files and record exact tag/commit, hashes, imports,
Host policy, behavior result, and untested scope. A module that validates, a
Lib that initializes, and a source program that links are distinct claims.
