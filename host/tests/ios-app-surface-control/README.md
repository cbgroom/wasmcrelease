# iOS App surface-control laboratory

This isolated simulator laboratory demonstrates five application-owned surfaces
without changing the fixed Host. Agent progress is produced by in-App semantic
activation (`UIControl.sendActions`) rather than physical touch injection. One
surface requests human intervention, expands without recreating its View,
accepts user input, contracts to its original position and resumes Agent work;
the other four surfaces continue progressing during the handoff.

The v2 interaction keeps Agent-owned cards inert, requires a read-only preview
followed by an explicit Confirm Takeover action before ownership changes, and
can collapse the whole task shelf into one edge dock. Agent work continues while
the shelf is docked, so idle tasks do not occupy the user's working area.

The WIT file is the proposed small public capability shape. The Swift code is a
native prototype adapter and is not an admitted or released Lib. The UI test
uses XCUITest only to represent the real human handoff; Agent actions never use
XCUITest or `UIApplication.sendEvent`.

Run on one exact booted simulator:

```sh
WASMC_IOS_SIMULATOR_UDID=<uuid> node scripts/test-ios-app-surface-control.mjs
```

This test does not qualify physical-device behavior, arbitrary custom controls,
WKWebView-backed surfaces, cross-origin Web frames, WIT-to-Wasm lowering,
admission or release. All five retained v1 surfaces are UIKit views; the WIT
keeps `web` as a future exact binding kind without claiming it was exercised.
