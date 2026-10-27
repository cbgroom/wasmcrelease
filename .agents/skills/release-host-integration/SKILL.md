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

## Fixed, Lib-defined Host boundary

The target Host contains no canonical domain capability inventory. File,
process, network, service, protocol, database, device and accelerator semantics
belong to exact Lib packages. WIT owns each public domain API and the matching
Lib owns its physical native boundary descriptor. Rust and JavaScript Host code
implements only execution, opaque target/resource identity, bounded windows,
operations, completions, cancellation, late-completion drain and release.

Before proposing a Host change, first prove that a new exact Lib plus the
existing native boundary descriptor cannot express it. A mechanism change
requires executable evidence from multiple independent Lib domains and a new
architecture version. Adding a domain-specific operation to a universal opcode
or platform provider is not boundary reduction.

Example: TLS, file systems, process models, network transports and device
models are Lib graphs. Their platform-specific physical calls are Lib-owned
descriptors executed by one fixed Host boundary; they are not Rust Host API
families. Pure Rust alone proves neither Wasm portability nor production
qualification.

Completion, cancellation and ownership mechanisms remain shared between JS and
Native; low-copy windows/batch/ring are optional acceleration. Domain-specific
stream, datagram, durability and device semantics remain in Libs. Browser
restrictions must not cap Native.

Public Host boundary/glue may be maintained here; compiler and Lib producer
authority is unchanged. Read the
[Lib-defined boundary workstream](../../../docs/HOST_LIB_DEFINED_BOUNDARY.md)
before changing Host code. Existing v0 file/TCP/UDP drivers are retained
migration evidence, not extension points. Do not call simulator success real
I/O, a descriptor design an implemented adapter, or native build proof
browser/mobile support.

## Integration layers

- JavaScript facade is the default Node/browser-family consumer path.
- Raw compiler Core Wasm is the portable ABI path for other hosts.
- The Rust project is executable Wasmtime reference code, not an SDK crate.
- `lib_core.wasm` is the matching managed-value Core provider; standalone Libs
  additionally publish WIT-authoritative Core and Component views.

Choose the smallest layer that satisfies the caller. Do not add a wrapper when
copyable reference code exposes the contract more clearly.

## Dual-language glue qualification

For a release that offers both ordinary WAsmC and Rust callers, continuously
qualify both paths against the same actual selected release inputs. Pin and
read back the compiler, CoreLib, Lib Root, generated SDK and relevant Host
contract by exact version and digest. Compile and execute real WAsmC source
and a real Rust consumer through their supported entry points. Where both use a
Lib, resolve the same published Root and provider bytes; do not substitute a
mock, an independently rebuilt lookalike or a version label for that identity.
Record which path actually imports CoreLib: a standalone Rust SDK that does not
use it is useful evidence for that SDK, but is not shared-CoreLib parity.

Compare the overlapping public operations with the same inputs and observable
results, including ordinary success, invalid input or Host error and recovery on
the same instance. Exercise non-UTF-8 bytes for byte APIs, and actual caller
capability rejection where the Host contract exposes it. Check cleanup using
the available ownership or pending-resource oracles. Record uncovered API
families and engine or Host limitations explicitly; a narrower passing case
does not qualify the entire API. Pin the app and test inputs and distinguish
simulated Host, actual Host, installed artifact and Hosted route results.
Qualify the final published tuple again through its real installation path;
pre-release candidate tests are not evidence of publication or installation.

The 2026-10-27 HTTP comparison in the
[workstream evidence](../../workstreams/WS-20261026-lib-memory-release-v031/qualification/http-language-pair-20261027/)
ran Rust and WAsmC guests against a simulated common Host in Node and Deno. It
matched response status, header, non-UTF-8 body and control, and a header
failure followed by same-instance recovery. The Rust guest did not consume the
selected WAsmC CoreLib or JSON Lib, so that observation does not establish
shared-Lib or shared-CoreLib parity, real Hosted acceptance, or a release.

The separate [JSON dual-glue candidate evidence](../../workstreams/WS-20261026-lib-memory-release-v031/qualification/json021-dual-glue-20261027/)
compares the same JSON 0.2.1 candidate Core artifact through the generated Rust
SDK and ordinary WAsmC. Node and Deno pass the same edit, invalid-input
fallback and same-instance recovery for three inputs. Rust dynamically binds
the installed artifact; WAsmC links the byte-identical artifact into its App
with CoreLib. The Rust Guest does not import CoreLib. Both paths thus prove a
bounded shared-Lib case, not shared-CoreLib parity, full API coverage, native
runtime parity or a formally released product. WAsmC HTTP framing is simulated.

## Host authority and lifecycle

Real asynchronous I/O cancellation suppresses delivery, not already-issued
external effects. Keep window ownership pinned until backend completion proves
it has stopped accessing the window; a late completion may drain but must not
publish cancelled bytes or replay an effect. Never force-release on timeout
without safely terminating/quarantining the backend. Revocation must deny new
grants/delivery while still permitting drain and cleanup. Qualify malformed,
foreign/stale/duplicate completions and terminal-record quotas with independent
state/resource oracles. Read [completion guard](../../../host/runtime/completion/README.md)
when extending the public prototype; its single-registry process-local identity
is not restart-safe or a completed typed Core ABI. Serialized trace success is
not OS concurrency/fault proof. Simulator cancel guarantees remain narrower.

- For v0.0.15 compatibility, inspect every generated import and bind only the
  exact released functions. For the successor full-host profile, bind only the
  fixed boundary mechanisms; domain selection and semantics come from the exact
  Lib graph rather than per-domain Host allowlists.
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
