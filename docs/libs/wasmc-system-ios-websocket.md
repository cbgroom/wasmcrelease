# Current implementation: wasmc-system-ios-websocket

Source authority: `libspec/wasmc-system-ios-websocket/lib.json`.
Native platform source does not imply Wasm lowering or device admission.

# iOS WebSocket provider

This candidate maps `wasmc:system-websocket@0.0.1` to
`URLSessionWebSocketTask` without extending the fixed Host. Its package-local
example proves exact text messages in both directions while foregrounded and
during one finite UIKit background-task window. The dev.5 provider also pins
the exact DER SHA-256 of a repository-local self-signed WSS fixture certificate
and rejects any different certificate. A separate deterministic experiment
stops and restarts that service, observes the disconnect, retains one message
in a process-memory outbox, reconnects with bounded retries and receives the
exact post-restart acknowledgement.

A separate relaunch experiment atomically persists two ordered messages as JSON,
terminates the first App process, loads the same queue in a second process, drains
one message at a time after its exact acknowledgement, and retains an empty queue.
The idempotency experiment then terminates a second process after the server has
applied message `durable-1` but before its ACK is persisted. A third process
replays the stable message ID; the fixture reports `duplicate:1`, while the next
message reports `applied:1`, proving effect-once behavior for the retained fixture.

The Simulator loopback fixture is not evidence for public-CA WSS, Internet routing,
OS network transitions, general-purpose queue capacity/compaction, arbitrary
crash points, suspension-time delivery, long-lived
background sockets, large frames or backpressure. An ordinary WebSocket cannot
wake a suspended or terminated iOS App; remote system notification and durable
server-side state remain separate capabilities.
