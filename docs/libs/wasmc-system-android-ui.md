# Current implementation: wasmc-system-android-ui

Source authority: `libspec/wasmc-system-android-ui/lib.json`.
Native platform source does not imply Wasm lowering or device admission.

# Android UI binding Lib

Unreleased Android physical binding for the platform-neutral
`wasmc:system-ui@0.0.1` WIT API. It returns the current semantic UI hierarchy
and foreground-window state. Android command and service details remain in this
Lib adapter; the fixed Android Host is domain-neutral. Snapshot publication is
checked with a bounded wait after the Android command succeeds, so a transient
file-visibility delay does not escape as a false operation failure.

This is emulator qualification evidence, not admission or release.
