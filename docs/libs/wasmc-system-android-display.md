# Current implementation: wasmc-system-android-display

Source authority: `libspec/wasmc-system-android-display/lib.json`.
Native platform source does not imply Wasm lowering or device admission.

# Android display binding Lib

Unreleased Android physical binding for the platform-neutral
`wasmc:system-display@0.0.1` WIT API. The exact adapter obtains a PNG frame
through Android's `screencap` service. The fixed Android Host only verifies and
invokes the descriptor and contains no display API or Android service name.

This is emulator qualification evidence, not admission or release.
