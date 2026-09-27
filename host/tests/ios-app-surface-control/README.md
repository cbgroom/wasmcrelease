# iOS App surface-control laboratory

This isolated simulator laboratory demonstrates five application-owned surfaces
without changing the fixed Host. Agent progress is produced by in-App semantic
activation (`UIControl.sendActions`) rather than physical touch injection. One
surface requests human intervention, expands without recreating its View,
accepts user input, contracts to its original position and resumes Agent work;
the other four surfaces continue progressing during the handoff.

The WIT file is the proposed small public capability shape. The Swift code is a
native prototype adapter and is not an admitted or released Lib. The UI test
uses XCUITest only to represent the real human handoff; Agent actions never use
XCUITest or `UIApplication.sendEvent`.

Run on one exact booted simulator:

```sh
WASMC_IOS_SIMULATOR_UDID=<uuid> node scripts/test-ios-app-surface-control.mjs
```

This test does not qualify physical-device behavior, arbitrary custom controls,
cross-origin Web frames, WIT-to-Wasm lowering, admission or release.
