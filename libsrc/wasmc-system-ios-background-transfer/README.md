# iOS background-transfer provider

This package implements `wasmc:system-background-transfer@0.0.1` with an iOS
background `URLSession`. Transfer semantics, durable result storage and the
Apple binding belong to the Lib; the fixed Host gains no URLSession or network
API.

The package-local example downloads a throttled deterministic payload while the
Simulator App is behind the Home screen, persists it atomically, records the
delegate completion phase and validates the final byte count and SHA-256.
The v2 candidate also qualifies cancellation: the exact task reaches
`NSURLErrorCancelled`, publishes no completed result and leaves no durable
payload. A termination probe did not observe automatic background relaunch or
`handleEventsForBackgroundURLSession`; explicit activation recovered the final
payload, so automatic process relaunch remains unqualified. Physical-device
delivery, discretionary scheduling, cellular policy, authentication challenges,
upload bodies, resume data and delivery after jetsam remain open.

```sh
WASMC_IOS_SIMULATOR_UDID=<uuid> node scripts/test-ios-background-transfer.mjs
```
