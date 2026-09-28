# Dynamic Lib graph model v1

Status: prototype model; qualified locally only; not admitted or released.

This model is the authority for the next Client Foundation/Gateway slice. The
existing `dynamic-lib-graph.mjs` is an executable experiment against the serial,
stateless subset. Gateway commands and durable state must not be designed from
that implementation alone.

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
publication, generation capture, drain, rollback and final resource cleanup.
Its pipeline is the serial stateless subset and has no configuration object.

Before Gateway integration, the implementation must add canonical graph
digests and explicit configuration hashes. General DAG scheduling, WIT port
compatibility, stateful replacement, durable retired-generation cleanup and
restart reconstruction remain open gates. Until those close, Gateway support
must be labeled serial-stateless prototype rather than general dynamic Lib
composition.
