# Host Core API v1 candidate baseline

Status: `1.0.0-draft.1`, **candidate, not accepted runtime ABI or released SDK**.
This fixes the initial mechanism vocabulary and review rules, not immutable
physical signatures. [baseline inventory](core-api-v1-baseline.json) is a
machine-readable design inventory, not a guest RPC or substitute for WIT.

## 1. Purpose and counting

WAsmC/Rust App -> typed WIT API -> CoreLib -> thin Host -> platform.
Compiler implementation remains private; Host/engine integration can be public.
CoreLib owns algorithms and ordinary String/List/Map/Bytes memory management.
Host owns external authority, transport, external resource lifetime and limits.

The starting inventory is **12 mechanism families**:10semantic mechanisms plus
2window-carrier helpers. Keep within a20family design budget; do not fill unused
slots. A future justified exception can revise the budget through review.
Count any independently callable new Host mechanism, including extensions, in
the inventory: do not hide it in `invoke` or a feature-specific helper.
This is not yet a count of Wasm imports/exports: the physical carrier may need
adapter helpers and every such helper must be separately inventoried at ABI review.
The20budget must not be advertised as an established physical function count.

Canonical semantic names use kebab-case below. Rust/WAsmC SDK spelling replaces
hyphens with underscores only. Do not introduce fast/ultra source API aliases.
WIT will own exact public typed signatures; a digest-bound Core mapping will own
physical lanes. Neither Rust ABI nor JS object layout crosses a Core boundary.

## 2. Initial inventory

| Family | Contract and result | Admission/ownership |
|---|---|---|
| `describe` | Bounded contract/ABI/features/limits, supported typed operation identities and rights; no grant or external effect | Injected root or owned endpoint; no ambient enumeration |
| `open` | Derive a typed child endpoint from a parent and validated selector; immediate or correlated pending result | Child rights must be a subset; failed admission retains caller-owned request |
| `read` | Read into a bounded writable window; return transfer count, EOF/message metadata or pending operation | Explicit endpoint right; offset only when endpoint supports it; destination pinned |
| `write` | Write committed valid bytes; return actual transfer count or pending operation | Snapshot/pin source before issue; partial transfer is not implicit retry |
| `invoke` | A negotiated typed external operation not represented by ordinary read/write; immediate or pending typed result | Exact contract/operation identity and right; finite declared request/result layout |
| `wait` | Wait for a bounded selected operation set until any completion or wait deadline; return correlated receipts | Real readiness/wakeup, not busy polling; no authority grant or effect replay |
| `cancel` | Request cancellation and suppress undelivered result; report accepted/already-terminal/unsupported | Does not prove stop, no effect or rollback; retains pins and quota |
| `release` | Request retirement of an idle resource; released, closing(operation), busy or failure | Busy resource is not consumed; retire only after real close/settlement acknowledgement |
| `clock-read` | Read an explicitly authorized monotonic or wall clock with declared unit/epoch | No synthetic fallback; monotonic operation deadlines use the negotiated clock domain |
| `entropy-fill` | Fill a bounded destination with explicitly authorized secure entropy; immediate or pending | Destination pinned; insecure PRNG is not an equivalent fallback |
| `window-acquire` | Acquire a bounded external-I/O transfer window in the session; return owned window | Byte/count quota before allocation; not general-purpose guest allocation |
| `window-commit` | Validate/publish initialized valid bytes for Host consumption | Only idle writable window, bounds checked; no mutation of a pinned source |

All effectful submissions follow one model: admission error before issue, or an
immediate terminal receipt, or an owned correlated operation. Open can return a
child; read can report EOF; write reports transfer; release can report closure.
Exact result variants/signatures are a mandatory semantic-WIT review item, not
permission to reuse today's v0 `completion { transferred }` for every result.

## 3. Capability and operation boundary

Root capabilities are injected by embedding policy before execution. `open`
cannot bootstrap unrestricted filesystem/network/credentials/process authority.
Selectors, paths, peer addresses, offsets, flags and quotas are typed, bounded
and checked before effects. Path traversal/symlink escape and peer changes are
policy errors, not delegated unchecked to platform libraries.

`invoke` is not JSON RPC, an arbitrary method name, executable payload or raw
native symbol lookup. Its semantic WIT and request/result schema are bound to a
reviewed identity. The binding must list the finite external operation set and
reject unknown IDs before effects. Agents see typed SDK calls, never numeric
opcodes, handles, registry nonces or allocation plans. A new irreducible external
operation carried by `invoke` still requires extension review; dispatch must
not disguise unbounded native API growth.

Examples: accept, stream half-close, storage sync, native name resolution and
non-exportable-key signing can be endpoint-scoped typed operation contracts
where needed. They are candidate contracts, **not currently promised support**.
New pure HTTP/TLS/codec/retry policy ordinarily needs no new native operation.
DNS can be a CoreLib protocol over granted transport; system resolver access,
if required, is explicit optional authority, never an ambient default.

## 4. Data carrier and ownership

For the window-based Core carrier, both window helpers and bounded **copy
windows are required**. Shared windows, zero-copy, batch acceleration and ring
transport are optional later profiles. The earlier shorthand "optional window
API" applies to acceleration, not absence of a data carrier for read/write.

Host transfer windows are external-I/O resources; internal data structures and
general allocators stay in CoreLib. No cross-module raw pointer requiring an
unrelated allocator's free. A future shared view must validate provider domain,
ABI/digest, bounds, access rights and borrow lifetime before linking/access.
Copying is the safe initial profile; shared-everything is not claimed.

Every resource is scoped to one binding/session/owner. Reject fabricated,
foreign, stale and duplicate references. No live token reuse after wrap,
restart or registry rotation. Scoped identities are not authorization by secrecy.
Pin all source/destination/endpoint resources used by an issued operation.
No readout, mutation, release or reuse of a pinned window. Multi-window overlap
and aliasing must reject or be explicitly validated by the selected contract.

Quota covers active plus quarantined resources, pending plus undelivered terminal
records, transfer bytes and queued result bytes. Returning/dropping a Future
must not silently free a still-running backend. Terminal receipt consumption
and backend stop acknowledgement are distinct events. Returned native-owned
batches remain subject to embedding delivery budgets; current reactor in-flight
limits alone do not close queued-result accounting.

## 5. Completion, cancellation and retirement

Operation lifecycle: admitted -> pending -> terminal -> consumed -> retired.
Delivery suppression and backend settlement are separate axes. A cancelled or
timed-out operation may still be pending physically; keep its pins/quota until
settled, then retire without delivering suppressed payload. Quarantine is a
retained unsafe-to-reuse state, not a successful terminal cleanup.

Every receipt includes operation correlation, typed result/error, known actual
transfer/effect information and a clear outcome when effects are unknown.
Batch wait must identify each operation; no unlabelled list of transfer counts.
There is one terminal result, with no automatic replay/reissue/promotion.
Repeated observation is passive; consumption is exactly once and separately
defined. Foreign/stale/duplicate or malformed completion cannot drain a pin.

Two deadlines are distinct: `wait` deadline only ends that wait; an operation
deadline suppresses undelivered results and requests stop. Neither force-frees
resources or undoes writes. Local clock domains never become comparable remote
timestamps without explicit conversion. EINTR/spurious wakes recheck absolute
deadlines. Cancel before terminal publication suppresses delivery; cancel after
terminal publication reports already-terminal and cannot erase an accepted
result. Each binding must define/test that linearization point.

Release cannot consume ownership on busy/failure. During asynchronous closing,
retain the resource and prohibit new use until close acknowledgement. Failed
close/stop retains quarantine and quotas; explicit cleanup may retry retirement,
not business I/O. Never-settling backends require safe outer containment, not a
fabricated zero-live-count acknowledgement. Resource destructors/Future drop
request safe cleanup, not a promise of synchronous physical termination.

Expected categories: invalid-resource, permission-denied, unsupported, limit,
busy, bounds, cancelled, timeout, external-failure, outcome-unknown and
already-terminal. Platform details can be bounded diagnostics; numeric status
values from different prototypes are not v1 ABI assignments. Partial write,
datagram truncation and durability acknowledgement need typed operation results.

## 6. Endpoint families and portability

| Scenario | Existing mechanism composition | Not native mandatory |
|---|---|---|
| CLI/files | Injected stdio/file roots; open/read/write/release; optional typed seek/sync | Arbitrary paths, process launch, all platform directory layouts |
| TCP service/client | Granted network parent; typed connect/listen selector and accept/half-close; read/write/wait | Automatic reconnect/replay or unlimited listeners |
| UDP | Granted datagram endpoint; typed peer/message metadata via declared operation layouts | Stream conversion, reliability or browser raw UDP simulation |
| HTTP | CoreLib protocol over a granted stream; browser fetch adapter only if explicitly described | A new HTTP Host syscall for every protocol feature |
| TLS | CoreLib protocol/certificate parsing plus transport, authorized time/entropy/trust bytes | Mandatory OS crypto or ambient certificate-store access |
| Credential/device | Optional typed endpoint contracts using invoke/windows/wait | Returning secret strings or uniform hardware support |

Stream EOF/partial reads differ from datagram boundaries/truncation. Sync means
the negotiated storage durability contract, not merely buffer acceptance. Typed
accept and control contracts are required before a service profile is accepted.
TLS needs reviewed crypto, trust policy and interoperability qualification;
mechanism composition is not evidence that a TLS implementation is portable.

Negotiate contract revision, exact WIT/schema and physical ABI identity, required
Wasm features, endpoint rights/operations and resource limits before effects.
Filter describe by actual granted authority. Native may have capabilities that
JS/browser lacks. Missing required capability yields deterministic unsupported
or admission failure: no native TCP disguised as browser fetch, insecure entropy,
simulated device or synthetic clock. Optional absent capabilities need not make
the entire Host unusable. Engine support does not prove platform permission.

## 7. Existing evidence and acceptance work

v0's twelve-family draft and seven-import simulator remain unchanged. Its WIT
is a historical semantic draft, **not v1 typed or physical authority**; notably
uncorrelated wait receipts and consuming busy release must not be copied into v1.
File/TCP/UDP/resident/guard fixtures and optional single/shared Native readiness
are component evidence. Check their exact Git/Actions receipts; none alone
accepts the uniform12family v1 contract. No compiler/CoreLib bytes change here.

Before v1 acceptance:

1. Finalize parser-validated semantic WIT: selectors, typed result variants,
   correlation, status/outcome, non-consuming busy release and scoped ownership.
2. Bind a deterministic Core SDK/carrier: scalar/status layout, buffer access,
   resource/provider identities, ABI digest/epoch and physical helper inventory.
3. Close Future/wakeup and terminal-result quotas; qualify no replay and actual
   stop/close, revocation, timeout and failed-retirement containment.
4. Run ordinary WAsmC/Rust App -> CoreLib -> real Host equivalence on Wasmi and
   Wasmtime; run JS/Native capability parity and explicit unsupported controls.
5. Qualify file CLI, TCP client/server, UDP and CoreLib HTTP/TLS compositions,
   desktop/mobile/browser scopes separately, performance/memory and exact SDK
   delivery. Compilation is not mobile device execution.

Do not convert these steps into completed percentages from documentation alone.

## 8. Evolution review

Stable means low-frequency justified evolution, not an eternal freeze. Before
adding/changing a mechanism, prove CoreLib cannot supply it, then prove existing
Host composition cannot supply it. Record the irreducible external capability,
security/correctness/performance reason, affected adapters, migration/negotiation,
quota/lifecycle rules and executable tests. Include every independently callable
mechanism in the budget, even if physically dispatched via invoke.

Pure protocol/algorithm/library updates should normally change only CoreLib.
Optional negotiated extensions may evolve without granting broader authority
or forcing all platforms to implement them. Breaking semantic/physical changes
require their own identity/ABI epoch; never repurpose an old digest or rewrite an
immutable release. Acceptance needs reviewed exact-source evidence, not a draft
version bump. This specification milestone does not promote main/prod or SDK.
