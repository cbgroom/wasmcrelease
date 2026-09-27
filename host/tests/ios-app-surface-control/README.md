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

The v3 successor projects one focused task into the system Picture in Picture
window through a Lib-owned `AVSampleBufferDisplayLayer`. PiP is explicitly
user-started, read-only, and does not replace the five in-App surfaces or their
confirmed handoff state machine. The fixed Host remains unchanged. The
laboratory qualifies platform mechanics only; production use must still carry
genuine media/task-observation semantics acceptable for its distribution path.

The platform-neutral WIT, candidate metadata and Apple-specific Swift adapter
now live together in `libsrc/wasmc-system-ios-app-surface-control`; this test
directory is only a qualification application. The exact target profile is
resolved at `host/platform/ios/app-surface-control-profile.json`. The provider
is not an admitted or released Lib. The UI test
uses XCUITest only to represent the real human handoff; Agent actions never use
XCUITest or `UIApplication.sendEvent`.

Run v3 on one exact booted PiP-capable iPad simulator:

```sh
WASMC_IOS_SIMULATOR_UDID=<uuid> node scripts/test-ios-app-surface-control.mjs
```

The retained local target is an iPad Pro 13-inch (M4) simulator on iOS 26.5.
The same runtime's iPhone 17 Pro simulator reports
`AVPictureInPictureController.isPictureInPictureSupported() == false`, so it is
an explicit unsupported target rather than a v3 qualification target. The UI
test retains an active-PiP screenshot, but AV sample-buffer video is rendered
through a capture-sensitive system surface; a black captured PiP rectangle is
not treated as proof that the live onscreen content was black or visible.

This test does not qualify physical-device PiP pixels, arbitrary custom controls,
WKWebView-backed surfaces, cross-origin Web frames, WIT-to-Wasm lowering,
admission or release. All five retained v1 surfaces are UIKit views; the WIT
keeps `web` as a future exact binding kind without claiming it was exercised.
