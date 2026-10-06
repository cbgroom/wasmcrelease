# Current implementation: wasmc-system-ios-simulator-display

Source authority: `libspec/wasmc-system-ios-simulator-display/lib.json`.
Native platform source does not imply Wasm lowering or device admission.

# iOS Simulator display provider

This candidate implements the platform-neutral `wasmc:system-display@0.0.1`
API for an Apple-hosted iOS Simulator. Its native adapter uses the public
`xcrun simctl io ... screenshot` supervisor interface and requires the exact
simulator UDID in `WASMC_IOS_SIMULATOR_UDID`.

The adapter is deliberately scoped to the target tuple
`ios/aarch64/simulator/supervisor`. It does not execute inside an iOS app and
does not qualify an iPhone, system-wide semantic UI access, input injection or
virtual input. Those capabilities remain absent and fail closed in profile
resolution.
