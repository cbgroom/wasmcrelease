# iOS WebSocket example

The UI test connects to the deterministic host-side loopback WebSocket fixture,
exchanges an exact foreground message, presses Home, then exchanges a second
exact message in both directions during a finite UIKit background-task window.
The secure variant repeats the same lifecycle over a pinned local WSS fixture;
it does not claim public-CA or Internet routing coverage.
