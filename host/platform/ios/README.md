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
