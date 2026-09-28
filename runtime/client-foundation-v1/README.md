# Client Foundation v1 prototype

For active `snapshot-v1` restart durability and Gateway receipt ordering, start
with `agent-checkpoint-orientation.json`. It is the compact bounded route; open
the broader model or implementation only for an explicit implementation-line
audit or a failed named check. Its validator binds the compact claims to source
and test anchors, so citing named evidence does not require rereading it.

This directory is a higher-layer, persistent client foundation built above the
fixed Lib-defined Host boundary. It does not change `current/cli.mjs`, add a
domain API to the Host, or load a provider around the Host. Every provider
probe, health check and invocation uses the existing
`LibDefinedBoundary` resource/window/operation/completion lifecycle.

The prototype separates three layers:

1. The immutable factory provider is an always-retained rescue path. An A/B
   update never overwrites it.
2. Mutable graph providers occupy `slots/A` and `slots/B`. A candidate is
   downloaded over HTTPS, checked as a whole artifact and file by file,
   installed through the Host boundary, probed, and health checked before and
   after route activation.
3. A WSS control session carries sequenced commands and durable receipts. A
   reconnect advertises the last consumed server sequence and active graph
   revision. Replayed message identities return their prior receipt without
   installing the graph again.

Activation first records `active-probation` with the previous revision and
last-known-good route. A failed post-activation health check restores that
route. A process that opens a probation state also rolls back conservatively
before reconnecting. If the committed active slot is missing, corrupt, or fails
its probe at startup, the foundation loads the immutable factory provider and
reports that rescue state on its next connection. Only a committed route
releases the former Host resource; the package on disk remains available in
its retained slot.

Run the local qualification:

```sh
node scripts/test-client-foundation-v1.mjs
```

The qualification intentionally commits one dynamic provider, drops the WSS
connection, verifies duplicate-command replay after reconnect, activates a
candidate that fails its post-switch health check, proves rollback, and then
proves cold recovery from the persisted active slot. It also checks that the
minimal CLI and fixed Host executor remain byte-identical. A final destructive
negative control removes the active slot from the temporary state tree and
proves factory rescue.

This is local prototype evidence, not admission or release. The gateway and
providers are fixtures, the TLS identity is repository-local, and mobile or
physical-device behavior is not qualified. Graph commands now persist their
inflight identity before execution and persist the graph outcome with the
active route; restart reconstructs the receipt before reconnecting. General
exactly-once behavior for an arbitrary provider invocation with external side
effects is not claimed: those providers still require their own idempotency
identity or transaction protocol before production admission.

## Dynamic multi-Lib graph qualification

The normative prototype model is
[`docs/DYNAMIC_LIB_GRAPH_MODEL.md`](../../docs/DYNAMIC_LIB_GRAPH_MODEL.md), with
the machine-readable state model in `dynamic-lib-graph-model.json`. The model,
not the current serial implementation, is the input to future Gateway and
durability work. For stateful replacement, read its **Stateful replacement
quick authority** section before inspecting implementation or tests; it is the
single index for package authority, transport checks, the 1 MiB envelope,
ordering, Host/CLI boundaries, exact white-box evidence paths and explicit open
gates. Do not search for alternate Gateway or crash-runner paths.

`dynamic-lib-graph.mjs` exercises the next layer of mutability without adding
another Host operation. One generation owns a named set of Lib resources and
an ordered pipeline. Applying a new generation:

1. independently recomputes the exact package identity over the descriptor,
   WIT and adapter bytes;
2. reuses a block only when its verified artifact and declared Lib identity
   match the active block;
3. installs, probes and health-checks only changed blocks;
4. health-checks the complete candidate graph before one atomic publication;
5. lets old in-flight calls drain on their captured generation, then releases
   only resources no longer reachable from the new generation.

The serial graph specification has a canonical SHA-256 identity independent of
node declaration order and local package paths. It binds pipeline order, exact
package and Lib identities, canonical JSON configuration hashes, stateless
policy and exact whole-WIT hashes. Configuration is copied from its canonical
form before publication, so caller mutation cannot change active behavior
without a new graph identity. The whole-WIT rule is safe but deliberately more
restrictive than port-granular WIT compatibility.

The same engine also has a locally qualified general-DAG profile. Exact package
manifests bind named input/output ports to type identities derived from
`wasm-tools component wit --json`; the manifest is bound to the exact WIT hash
and included in the package hash. The scheduler rejects cycles, missing or
multiply-produced inputs, disconnected nodes and incompatible edge types. It
runs each topological level concurrently and preserves the same immutable
generation, replacement, drain and rollback rules.

Updates are revision-fenced and serialized. A failed candidate leaves the old
generation active and releases every newly installed resource. A cleanup error
after publication cannot roll the route back to resources that may already
have been released.

Run its local qualification with:

```sh
node scripts/test-dynamic-lib-graph-v1.mjs
node scripts/test-dynamic-lib-dag-v1.mjs
```

The first test proves two-block composition, one-block replacement with unchanged
block reuse, old/new generation overlap, route-only reorder with zero installs,
canonical graph and configuration identity, rejection of false identity and
package hashes, whole-graph rollback on failed health, and zero retained Host
resources/windows/operations after close. The DAG test proves a diamond graph,
parallel branches, exact port-manifest verification, one-branch replacement
with three reused nodes and negative closure/type controls. This engine is
local prototype evidence. The Client/Gateway qualification also distributes
that graph over WSS/HTTPS, persists it, and reconstructs it after a Client
restart. The work is not admitted or released.

## Dynamic Client/Gateway loop

`dynamic-foundation.mjs` connects the stateless serial/general-DAG graph engine to the
persistent Gateway with the `lib-graph.apply` command. The Gateway resolves
every content-addressed bundle and rejects any mismatch among bundle, package,
Lib, WIT and canonical graph identities before enqueue. The Client downloads
over HTTPS, verifies again, stores exact bundles in a content-addressed cache,
and persists the active graph, revision and command outcome before returning a
receipt.

On restart, the Client independently verifies cached bytes and reconstructs the
same graph. If cache corruption prevents reconstruction, the control WSS loop
still connects with `runtime_available=false`; a later exact graph command
redownloads the damaged bundle and repairs runtime availability. Invalid
commands produce durable rejected receipts instead of trapping the ordered
stream forever.

The WSS connector observes cancellation before and during TLS/upgrade, and the
Gateway stops accepting upgrades before draining existing connections. This
closes the reconnect/shutdown race where a stop signal could be missed while a
new handshake was in flight.

Run the integrated qualification with:

```sh
node scripts/test-dynamic-client-foundation-gateway-v1.mjs
```

This closes restart reconstruction for both serial routes and general
stateless DAGs. Active `snapshot-v1` state is also checkpointed and restored;
cross-schema replacement uses an exact content-addressed migration Lib and
independently hashed migration plan. `sticky` restart disposition, external-effect
exactly-once semantics, cache retention policy and release admission remain
outside this slice.

Publication and retirement are separate durable events. Before an active graph
becomes recoverable, the Client persists its revision, command result and the
prior generation's cleanup record. Normal drain removes that record after Host
resource release. If the process exits in between, restart fences the previous
process-owned Host namespace, records a bounded recovery receipt and restores
the already-published graph. This does not reconcile external side effects
owned by a Lib.

State policy is also package truth. A `sticky` node is reusable only while its
exact instance identity is unchanged; automatic replacement or removal is
rejected. A same-schema `snapshot-v1` replacement quiesces new invocations,
drains old invocations, verifies a bounded content-addressed snapshot, restores
the candidate and publishes only after health succeeds. A failed restore rolls
back and releases the waiting invocations onto the old generation. Run this
qualification with:

```sh
node scripts/test-dynamic-lib-stateful-v1.mjs
```

After every `snapshot-v1` invocation, the Client persists the content-addressed
active checkpoint before returning. For a Gateway command, that checkpoint and
the invocation result share one atomic state write before receipt delivery. A
full Client restart restores the checkpoint before advertising runtime
availability. The integrated qualification also crashes after this write and
before receipt delivery, then proves receipt recovery and `SV2:2` state without
replaying the increment. Missing or corrupt checkpoints fail closed while the
control path remains available. A partial multi-block restore poisons that
graph instance until close and reconstruction. This narrows durability to Client-owned
snapshot state; it does not make arbitrary external effects exactly once.

Cross-schema migration is an ephemeral transition resource rather than a stable
graph node. Its plan binds the node, package, WIT, configuration and both schema
identities. The Client drains, snapshots, migrates, validates, restores and
health-checks before publication; failure rolls back the candidate and retains
the old generation. Restart disposition for `sticky` active state is not yet
implemented. The focused stateful test also rejects
package/declaration mismatch, policy transitions, removal without a state
disposition, non-canonical base64, digest mismatch and snapshots larger than
1 MiB. The integrated test proves distributed same- and cross-schema paths,
post-migration restart and active-state restart, and rejects forged Gateway
state and migration declarations.
