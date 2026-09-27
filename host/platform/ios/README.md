# iOS platform profiles

The qualified first slice is the Apple-hosted iOS Simulator observation
profile in `simulator-observation-profile.json`. It resolves the standard
`wasmc:system-display@0.0.1` API to one exact Lib-owned adapter and executes it
through the domain-neutral `native-apple-simulator` supervisor Host.

This is intentionally not an embedded iOS Host. Its exact target tuple is
`ios/aarch64/simulator/supervisor`; an iOS device or `embedding=native` request
does not match. System-wide semantic UI, tap/text/key input, virtual input and
physical-device support remain unavailable and fail closed.

`providers.json` remains retained v0.0.15 migration evidence. It is not the
extension authority and is not updated for this Lib-defined slice.

## Native app-internal profile

`host/tests/ios-app-capability` is the separate `ios/aarch64/simulator/native`
profile. It embeds one fixed, domain-neutral Swift Host in an ordinary iOS app
and selects eleven statically linked providers from `EmbeddedProfile.swift`.
Storage, state, POSIX loopback networking, UIKit semantics, window capture and
Metal, SQLite, CryptoKit, offline audio, WebKit and protected-capability
observation are provider code; the Host only validates registrations, byte
limits and result identity. The fixed Host source digest remains identical to
the earlier six-provider qualification.

Run the macOS qualification against one already booted simulator:

```sh
WASMC_IOS_SIMULATOR_UDID=<uuid> node scripts/test-ios-app-capability.mjs
```

This proves real App-sandbox execution in the simulator. It does not yet prove
Wasm component loading, a physical iPhone, background execution, or protected
camera/audio/location/motion/notification APIs. The simulator supervisor and
native app profiles are distinct and must not be substituted for one another.
