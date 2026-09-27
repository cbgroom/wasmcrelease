# iOS App lifecycle provider

This package implements the platform-neutral
`wasmc:system-app-lifecycle@0.0.1` contract for an iOS application without
adding a domain API to the fixed Host. The Lib-owned Swift adapter converts
UIKit lifecycle callbacks and finite background-task execution into a bounded,
append-only event journal. The journal is retained under Application Support so
the next process can distinguish foreground return from cold relaunch.

The package-local example qualifies three deliberately narrow facts on an iOS
Simulator: a real Home-button foreground/background/foreground cycle, bounded
work progressing while UIKit reports the App as backgrounded, and journal
recovery after process termination and relaunch. Simulator execution does not
qualify suspension, jetsam, watchdog termination, background-task expiration,
BGTaskScheduler delivery, background URLSession delivery, lock-screen behavior,
or any physical-device property.

The public WIT is reusable across platforms. This candidate contains only the
iOS physical binding; another OS must supply a distinct exact provider and
descriptor rather than introducing a platform switch in the Host.

Run against one exact booted iOS Simulator:

```sh
WASMC_IOS_SIMULATOR_UDID=<uuid> node scripts/test-ios-app-lifecycle.mjs
```
