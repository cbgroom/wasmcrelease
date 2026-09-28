# Dynamic Lib graph model v1

Status: prototype model; qualified locally only; not admitted or released.

For an active-state restart, Gateway receipt-ordering, checkpoint visibility or
failure-boundary question, read
`runtime/client-foundation-v1/agent-checkpoint-orientation.json`, run only its
named checks when execution is required, and stop. Open this full model or the
implementation only when a named check fails or the user explicitly requests
an implementation-line audit. A request to cite its named executable evidence
does not require reopening every evidence file. A general review, ordering
explanation or retrospective is also not an implementation-line audit.

This model is the authority for the next Client Foundation/Gateway slice. The
existing implementation is evidence, not a substitute for this model. Gateway
commands and durable state must not be designed from implementation alone.

## 1. Boundary

The Host remains fixed. It knows only opaque Lib resources, bounded byte
windows, asynchronous operations, completions, cancellation and release. It
does not know graph nodes, routes, domain capabilities, configuration, state
migration or rollback.

The Client Foundation owns graph generations and lifecycle. Exact Lib packages
own public WIT semantics and their native descriptors. The Gateway distributes
content-addressed desired graph specifications and receives durable receipts;
it is not runtime truth for a disconnected Client.

## 2. Desired graph

A desired graph is immutable and content addressed. It contains:

- `nodes`: stable node IDs. Each node binds an exact Lib identity, exact package
  SHA-256, configuration SHA-256 and state policy.
- `edges`: directed output-port to input-port bindings. Both ports bind exact
  WIT contract identities. Implicit type conversion is forbidden.
- `entrypoints`: named external inputs and outputs.
- `policy`: resource limits, activation deadline and failure behavior.

The v1 graph is a DAG. Cycles require an explicit future feedback/scheduler
model and are rejected. A serial pipeline is merely a DAG where each node has
one successor; it is not the general composition model.

The canonical graph digest covers nodes, edges, entrypoints and policy. Array
order is canonical only where it is semantic. A command cannot change behavior
while retaining the same digest.

## 3. Runtime generations

A generation is an immutable realized graph:

```text
desired graph digest
        |
        v
  preparing candidate --qualify--> active generation
          |                              |
          +--failure--> discard          +--new publish--> retired/draining
                                                   |
                                                   +--inflight=0--> reclaimed
```

The manager has exactly one active generation until close. A candidate is
never observable. Publication is the single activation linearization point.
An invocation captures and increments the active generation at its own
linearization point, before any replacement can reclaim that generation.

While a candidate is preparing, new invocations continue on the old active
generation. After publication, new invocations use the new generation while
old invocations finish on the generation they captured. Resources are released
only when no active, candidate or in-flight retired generation references them.

## 4. Replacement plan

Safe v1 reuse requires all of the following:

- the same stable node ID;
- the same verified Lib identity and package SHA-256;
- the same configuration SHA-256;
- the same exact port-contract-set SHA-256;
- the same state policy and state-schema identity.

Same code does not imply the same instance. Two node IDs may need independent
mutable state. Sharing one Host resource across node IDs requires a future
explicit `shareable-stateless` contract and is not inferred.

Changed nodes are verified, installed, probed and health checked. The complete
candidate graph is then checked for DAG shape, exact port compatibility,
entrypoint closure and resource policy before publication.

State policies are:

- `stateless`: replacement needs no state transfer.
- `sticky`: automatic live replacement is rejected.
- `snapshot-v1`: replacement requires exact source state-schema identity,
  bounded snapshot, target restore, and a declared exact migration Lib when
  schemas differ.

### Stateful replacement quick authority

Start here for the complete implemented state contract; do not reconstruct it
from Gateway metadata or test output.

| Surface | Role | Required behavior |
|---|---|---|
| exact package descriptor | authority | optional `state`; omission means `stateless`; `sticky` and `snapshot-v1` require a 64-hex schema identity |
| desired graph node | identity-bearing duplicate | policy and schema must exactly match the package and are covered by `graph_digest` |
| Gateway artifact metadata | derived transport check | derived from package bytes; a command that disagrees is rejected before enqueue |
| Client cache/install | independent transport check | package bytes are re-derived after download, on cache read and on restart reconstruction |

The implemented `snapshot-v1` envelope is canonical base64 of at most
1,048,576 decoded bytes plus its exact SHA-256 and schema identity. The source
and target schema identities must be equal. Replacement order is: install,
probe and health-check candidate; block new graph invocations; drain the old
generation; snapshot source; validate the complete envelope; restore target;
health-check the complete candidate; publish; durably record publication and
retired ownership; release the barrier; drain and release the retired
generation. The barrier is graph-wide. Restore or validation failure occurs
before publication, releases the candidate, retains the old generation and
releases waiting invocations onto it.

`sticky` permits only exact-instance reuse. Automatic replacement and removal
are rejected. Stateful removal has no disposition protocol in this slice.
Cross-schema replacement has no migration-Lib interface in this slice and is
rejected; the error names the required future authority rather than an
available operation.

The fixed minimal CLI is `current/cli.mjs`; the Gateway has a separate,
higher-layer CLI. Neither CLI nor the Host API participates in state transfer.
`snapshot-v1` and `restore-v1` are opaque Lib operations over the existing
resource/window/operation/completion boundary.

For active `snapshot-v1` state, the Client persists a
`wasmc.dynamic-lib-state-checkpoint/v1` record bound to the exact graph revision
and digest. Each block keeps the 1 MiB decoded envelope limit and the complete
persisted checkpoint is capped at 8 MiB. Publication persists the candidate's
checkpoint with the active graph before releasing the invocation barrier.
After a Gateway `invoke`, the updated checkpoint and command result are written
in one Client state transaction before a receipt is sent. A crash after that
write recovers the result without executing the invocation again; restart
restores and health-checks checkpointed blocks before reporting
`runtime_available=true`. Missing, stale or corrupt checkpoint identity leaves
runtime unavailable while the control connection remains usable. If a
multi-block restore fails after an earlier block has accepted state, the graph
is marked restore-failed: invoke, update and checkpoint operations remain
disabled until the graph is closed and reconstructed.

This closes restart restoration for active `snapshot-v1` state, not general
exactly-once execution. A crash before that joint write may leave an external
effect with no durable result, and a direct caller may lose the response after
the write. External effects still require the Lib's idempotency or transaction
contract. `sticky` active state remains fail-closed on restart because it has no
snapshot/disposition contract.

For a white-box review, use this bounded evidence index instead of searching
the repository:

| Question | Exact evidence |
|---|---|
| engine ordering, rollback and barrier | `runtime/client-foundation-v1/dynamic-lib-graph.mjs` |
| package descriptor validation and graph identity | `runtime/client-foundation-v1/dynamic-lib-graph-spec.mjs` |
| Client download/cache/restart checks and retired ledger | `runtime/client-foundation-v1/dynamic-foundation.mjs` |
| Gateway upload and pre-enqueue binding | `runtime/client-foundation-gateway-v1/gateway.mjs` |
| focused policy, concurrency and envelope negatives | `scripts/test-dynamic-lib-stateful-v1.mjs` |
| distributed state binding and publication crash | `scripts/test-dynamic-client-foundation-gateway-v1.mjs` |
| crash injection process | `scripts/fixtures/dynamic-client-publication-crash-runner.mjs` |
| invoke-checkpoint crash injection | `scripts/fixtures/dynamic-client-state-checkpoint-crash-runner.mjs` |
| runtime guard for fixed Host/minimal CLI bytes | `scripts/test-client-foundation-v1.mjs` |

Run exactly the focused test, this model's validator and the integrated test
with their documented `node ...` commands. They need no external shell timeout
wrapper. The `fixed_host_api_changed` and `minimal_cli_changed` fields printed
by dynamic tests are report labels; protected-path byte comparison is performed
by `scripts/test-client-foundation-v1.mjs`, while change-set scope is established
from the pinned Git commit. For this complete stateful slice, run exactly:

```sh
git diff --name-only bed1e4d236bb78a992355321deca8968a6400a0d HEAD -- host current runtime/client-foundation-gateway-v1/cli.mjs
```

No output is the expected proof that the Host, minimal CLI and higher-layer
Gateway CLI were not changed. Use the exact path list; never infer a path from
the abbreviated directory display produced by `git show --stat`.

The implemented same-schema `snapshot-v1` path binds policy and schema identity
inside the exact package descriptor rather than trusting a graph caller. It
installs and probes the candidate first, blocks new invocations, drains calls
already captured by the old generation, snapshots the quiescent source,
restores the candidate, health-checks it, and then publishes. Restore failure
releases the candidate, keeps the old generation active, and opens the
invocation barrier onto the old generation. `sticky` may be reused unchanged
but cannot be replaced or removed automatically.

Unknown or incomplete state policy fails closed. Draining in-flight operations
does not migrate hidden state and does not make external side effects exactly
once.

## 5. Manager state machine

The manager phases are `stable`, `preparing`, `draining`, and `closed`.

- `apply-request`: `stable -> preparing`, guarded by the expected active
  revision and exact desired-graph identity.
- `prepare-failed`: `preparing -> stable`; newly owned candidate resources are
  released and active is unchanged.
- `publish`: `preparing -> draining`; the qualified candidate becomes active
  atomically and the former active generation becomes retired.
- `drain-complete`: `draining -> stable`; resources referenced only by the
  retired generation are released.
- `cleanup-failed`: remains `draining`; the new generation stays active and
  cleanup is retried. Publication is never rolled back to partially released
  resources.
- `close`: accepted only without a preparing candidate; it denies new invokes,
  drains captured generations and releases all remaining resources.

Only one update may be preparing or draining. A later desired state is queued
by the higher layer or rejected with the current revision; it cannot interleave
resource ownership with the first update.

## 6. Required invariants

1. At most one active generation exists.
2. Active revision increases only at publication and never decreases.
3. No invocation observes a preparing candidate.
4. Every invocation stays on one captured generation.
5. A referenced or in-flight resource is never released.
6. Pre-publication failure leaves active identity and revision unchanged.
7. Post-publication cleanup failure never restores the old route.
8. Reuse never crosses node, artifact, configuration, or state-policy identity.
9. Every edge has exact compatible WIT port contracts and every entrypoint is
   closed.
10. Close eventually leaves zero resources, windows, operations and retired
    generations, assuming backend completions terminate.

## 7. Current conformance and open gates

The current executable prototype covers stable node IDs, exact Lib/package
identity, revision fencing, serialized updates, candidate invisibility, atomic
publication, generation capture, drain, rollback and final resource cleanup. It
now binds a canonical graph digest and canonical JSON configuration digest,
uses the complete reuse key, and supports both the original serial route and a
general acyclic graph. The DAG scheduler validates closure, rejects cycles,
computes deterministic topological levels and runs independent nodes in a level
concurrently. Its per-port type identities are derived from `wasm-tools
component wit --json`, bound to the exact WIT SHA-256, stored in a port manifest
that is part of the exact package hash, and rechecked against the installed
package. A caller-provided port hash therefore cannot override package truth.

The stateless Client/Gateway path now persists the exact desired graph,
content-addressed bundle locators, revision and command result. Restart verifies
every cached bundle and reconstructs the same runtime graph before reporting it
available. Cache corruption leaves the immutable control loop connected; an
exact subsequent command redownloads and republishes the graph. This closes
restart reconstruction for both serial routes and general DAGs. The Gateway
verifies package-bound port contracts before enqueue; the Client verifies them
again after HTTPS download and after every cache read.

General DAG scheduling, port-granular WIT contract identity, Gateway
distribution, Client restart reconstruction and durable retired-generation
cleanup are locally qualified. Publication now persists the new active graph,
the in-flight command result and a retired-generation record before drain.
Normal drain records resource release; a process crash is recovered by fencing
the prior process-owned Host resource namespace and retaining a bounded cleanup
receipt. Same-schema `snapshot-v1` replacement and fail-closed `sticky`
handling are qualified locally and through the Client/Gateway path.
Active `snapshot-v1` checkpoint restoration is now qualified across a full
Client restart, including a crash after joint checkpoint/result persistence and
before receipt delivery. Cross-schema migration through an exact migration Lib
and a restart disposition for `sticky` state remain open gates. The whole path
remains a prototype and is not admitted or released.

The focused local stateful qualification covers same-schema transfer,
graph-wide invocation fencing, restore rollback, sticky reuse/rejection,
package/declaration mismatch, policy transition, stateful removal without a
disposition, non-canonical base64, digest mismatch and the 1 MiB snapshot
bound. The integrated Client/Gateway qualification covers same-schema transfer
through distribution, active-state restart, checkpoint identity in the Gateway
hello, missing/corrupt checkpoint fail-closed behavior, invoke crash recovery
without replay, and rejection of a forged Gateway state declaration.

The process-owner fence does not claim exactly-once behavior or cleanup of
external effects that a Lib initiated outside the Host process. Such effects
remain governed by that Lib's idempotency, transaction or reconciliation
contract.
