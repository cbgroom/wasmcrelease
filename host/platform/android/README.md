# Android target Host

Android has one target-specific, domain-neutral Host implementation under
`host/runtime/lib-boundary/native-android`. Its stable boundary loads exact
Lib-owned descriptors and adapters; it contains no display, UI or input API.

`agent-computer-profile.json` binds platform-neutral display, semantic UI and
input WIT APIs to Android candidate Libs. The local Android 16 ARM64 emulator
qualification performs query → control → UI/frame confirmation through that
single Host binary. The retained `providers.json` remains v0.0.15 migration
evidence and is intentionally not updated by this successor workstream.

The profile also includes a platform-neutral virtual-input API backed by a
Lib-owned direct `/dev/uinput` adapter. Emulator qualification covers a real
virtual keyboard and touchscreen, persistent session recovery,
generation-checked resource reuse, session-EOF cleanup, concurrent-session
isolation, and semantic UI/frame confirmation without changing the Host binary.

This profile is not admitted or released. WIT-to-Wasm lowering and
physical-device qualification remain open.
