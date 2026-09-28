# Client Foundation v1 prototype

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

Updates are revision-fenced and serialized. A failed candidate leaves the old
generation active and releases every newly installed resource. A cleanup error
after publication cannot roll the route back to resources that may already
have been released.

Run its local qualification with:

```sh
node scripts/test-dynamic-lib-graph-v1.mjs
```

The test proves two-block composition, one-block replacement with unchanged
block reuse, old/new generation overlap, route-only reorder with zero installs,
rejection of false identity and package hashes, whole-graph rollback on failed
health, and zero retained Host resources/windows/operations after close. This
engine is local prototype evidence. It is not yet a durable Client Foundation
state format or a Gateway `graph.apply` command, and it is not admitted or
released.
