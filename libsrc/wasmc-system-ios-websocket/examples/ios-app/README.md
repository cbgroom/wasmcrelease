# iOS WebSocket example

The UI test connects to the deterministic host-side loopback WebSocket fixture,
exchanges an exact foreground message, presses Home, then exchanges a second
exact message in both directions during a finite UIKit background-task window.
The secure variant repeats the same lifecycle over a pinned local WSS fixture;
another secure test survives one deterministic fixture-service restart and
delivers one process-memory outbox message after reconnect. It does not claim
public-CA, Internet routing, OS network transition or process-relaunch coverage.
