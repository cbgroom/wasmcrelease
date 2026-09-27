# Android target Host

Android has one target-specific, domain-neutral Host implementation under
`host/runtime/lib-boundary/native-android`. Its stable boundary loads exact
Lib-owned descriptors and adapters; it contains no display, UI or input API.

`agent-computer-profile.json` binds platform-neutral display, semantic UI and
input WIT APIs to Android candidate Libs. The local Android 16 ARM64 emulator
qualification performs query → control → UI/frame confirmation through that
single Host binary. The retained `providers.json` remains v0.0.15 migration
evidence and is intentionally not updated by this successor workstream.

This profile is not admitted or released. WIT-to-Wasm lowering, direct Android
`/dev/uinput`, and physical-device qualification remain open.
