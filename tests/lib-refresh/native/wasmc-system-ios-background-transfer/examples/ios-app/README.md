# iOS background-transfer example

The UI test starts one deterministic 8 MiB download from the qualification
runner, immediately presses Home, waits for the background URLSession delegate
to persist the result, and reactivates the App. Acceptance requires the
completion callback to have observed UIKit's `background` state and the stored
bytes to match the runner's exact SHA-256.

The local HTTP origin is qualification infrastructure only. This example does
not claim production transport security, remote-network behavior or physical
device delivery.
