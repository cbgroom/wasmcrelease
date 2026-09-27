# iOS Lib capability spectrum

This is the evidence boundary for the current Lib-defined iOS workstream. It
does not alter the fixed Host API and does not describe admission or release.

## Qualified on the exact iOS Simulator

| Capability | Exact evidence | Boundary |
|---|---|---|
| App lifecycle | launch, active, resign-active, Home background, foreground return | UIKit callback order; not suspension |
| Finite background work | six journalled work ticks and completion before foreground | `beginBackgroundTask`; not later system scheduling |
| Process recovery | a second launch ID recovered the first process journal | explicit termination/relaunch; not jetsam |
| Background transfer | 8 MiB background URLSession download, background callback, atomic result, exact SHA-256 and cancellation with no late result | Simulator localhost; automatic process-relaunch delivery not observed |
| Background audio | playback session remains playing for 14 background samples and advances 3.283 seconds | Simulator clock mechanics; physical output, lock screen and interruptions pending |
| App-owned surfaces | five UIKit surfaces, dock, confirmed human takeover | application scope only |
| Picture in Picture | iPad Simulator start/stop/restore and frame submission | live pixel visibility and physical device pending |
| Authorization | Contacts allow/deny plus authorized CRUD cleanup | other protected domains are observation/planning only |
| App data and compute | storage, preferences, Keychain, SQLite, crypto, Metal, offline audio | active App execution |
| App networking and Web | POSIX loopback TCP/UDP and local WKWebView DOM/JS | no background transport continuity |

## Observed or configured, not qualified as execution

- background-refresh availability and protected-domain authorization states;
- audio background-mode declaration and playback-session configuration;
- camera, microphone, motion, location and notification availability;
- PiP support discovery on each simulator model.
- BGTaskScheduler handler registration succeeds on the exact Simulator, but
  refresh submission is rejected with `BGTaskSchedulerErrorDomain Code=1`;
  the deferred-work candidate therefore remains unqualified.

These observations must never be converted into a claim that the OS delivered
background work.

## Missing system-background evidence

1. physical-device suspension and resumption;
2. finite-task expiration and cancellation under OS pressure;
3. physical-device BGTaskScheduler submission plus refresh/processing delivery,
   expiration and relaunch;
4. background URLSession process-relaunch delivery, upload and resume data;
5. real-device audible background audio, lock screen, interruption and route-change behavior;
6. PiP after the App has backgrounded or the device has locked;
7. significant-location/region delivery, notifications and silent push;
8. network freeze/resume and durable SQLite/file recovery across kill;
9. WKWebView throttling, suspension and multi-WebView restoration;
10. memory pressure, thermal pressure, watchdog and jetsam recovery.

## Lifecycle status

The lifecycle provider and the earlier iOS providers are qualification
candidates. They are not admitted, released, discoverable or installable. WIT
to Wasm lowering and dynamic Component loading remain separate open gates.
