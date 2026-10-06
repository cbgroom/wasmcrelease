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
and selects twelve statically linked providers from `EmbeddedProfile.swift`.
Storage, state, POSIX loopback networking, UIKit semantics, window capture and
Metal, SQLite, CryptoKit, offline audio, WebKit and protected-capability
observation are provider code; the Host only validates registrations, byte
limits and result identity. The fixed Host source digest remains identical to
the earlier six-provider qualification.

The twelfth provider is the authorization broker. Discovery never prompts. It
centralizes exact permission states, request planning, in-flight deduplication
and persistent attempt history so individual domain Libs do not independently
nag the user. The policy permits a needed `not-determined` request again after
an unsuccessful attempt, once no request is in flight. Denied routes to a
reofferable Settings recovery path and unavailable/restricted fails closed. iOS system
prompts remain separate per permission category.

The thirteenth provider is an independent Contacts Lib. With Simulator Contacts
authorization granted it creates, fetches and deletes a temporary contact and
confirms cleanup. With authorization reset it does not attempt access. The
authorization broker and Contacts domain API remain separate Lib concerns.
The XCUITest qualification additionally drives the real localized system prompt
for both Share All and denial, then binds the callback result to actual Contacts
use or fail-closed behavior.

Run the macOS qualification against one already booted simulator:

```sh
WASMC_IOS_SIMULATOR_UDID=<uuid> node scripts/test-ios-app-capability.mjs
```

This proves real App-sandbox execution in the simulator. It does not yet prove
Wasm component loading, a physical iPhone, background execution, or protected
camera/audio/location/motion/notification APIs. The simulator supervisor and
native app profiles are distinct and must not be substituted for one another.

## Structured app surface-control profile

The app surface-control provider is packaged at
`libspec/wasmc-system-ios-app-surface-control`. Its public WIT is kept above the
`platform/ios` binding, while Swift sources and required Apple frameworks are
declared by the Lib-owned embedded-source descriptor. The generated
`app-surface-control-profile.json` selects it for the exact
`ios/aarch64/simulator/native` tuple. Other platforms must supply independent
providers for the same WIT API; they do not add branches to the fixed Host or
reuse iOS source by package-name inference.

The runnable application is shipped with the candidate source at
`tests/lib-refresh/native/wasmc-system-ios-app-surface-control/examples/ios-app`. Host tests do
not own or duplicate this example; repository qualification invokes it in
place through `scripts/test-ios-app-surface-control.mjs`.
