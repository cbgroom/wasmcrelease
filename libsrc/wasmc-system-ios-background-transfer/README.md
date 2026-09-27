# iOS background-transfer provider

This package implements `wasmc:system-background-transfer@0.0.1` with an iOS
background `URLSession`. Transfer semantics, durable result storage and the
Apple binding belong to the Lib; the fixed Host gains no URLSession or network
API.

The package-local example downloads a throttled deterministic payload while the
Simulator App is behind the Home screen, persists it atomically, records the
delegate completion phase and validates the final byte count and SHA-256.
This qualifies one exact iOS Simulator background-transfer path. It does not
qualify physical-device relaunch delivery, discretionary scheduling, cellular
policy, authentication challenges, upload bodies, resume data, cancellation,
or URLSession event delivery after jetsam.

```sh
WASMC_IOS_SIMULATOR_UDID=<uuid> node scripts/test-ios-background-transfer.mjs
```
