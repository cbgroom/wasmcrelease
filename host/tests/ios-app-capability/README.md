# iOS app-internal capability laboratory

This XcodeGen project qualifies what one ordinary embedded iOS application can
do while keeping its Host domain-neutral. `Host/FixedHost.swift` validates and
invokes opaque byte providers. `Profile/EmbeddedProfile.swift` is the only
deployment control plane that selects domain providers. Apple frameworks and
system calls are confined to `Providers/`.

The current simulator slice exercises thirteen provider families:

- atomic sandbox storage, file synchronization and readback;
- secure random, preferences, Keychain and clocks;
- real POSIX TCP and UDP loopback;
- UIKit semantic nodes and an action/state postcondition;
- in-app window PNG capture;
- Metal command-buffer copy and readback;
- SQLite WAL, transaction, prepared-statement and sandbox roundtrip;
- AES-GCM, P-256 signing and SHA-256 through CryptoKit;
- permission-free offline audio rendering;
- local WKWebView HTML/DOM/JavaScript execution;
- permission-free observation of camera, microphone, motion, location,
  notification and background-refresh availability/authorization;
- centralized zero-prompt authorization discovery, repeatable request planning,
  in-flight deduplication and persistent attempt history.
- authorized Contacts create/fetch/delete with cleanup, plus a separate
  not-determined fail-closed control.

The protected-capability provider never requests permission. `available=false`
on Simulator is retained as a platform observation, not reported as a Host or
Lib failure. Permission prompts, actual sensor samples and background delivery
belong to explicit physical-device and lifecycle qualifications.

Authorization is a Lib concern, not a Host API. The authorization provider
classifies thirteen existing capabilities as permission-free and observes ten
protected permission categories without prompting. Its planner requests a
needed `not-determined` category whenever no request is currently in flight;
an earlier unsuccessful attempt never permanently closes the request path.
Denied decisions route to Settings and that recovery route can be offered again,
while restricted or unavailable categories fail closed. Persistent attempt
history is evidence rather than a gate. One application
rationale screen can explain a batch, but iOS still owns separate system prompts
for separate permission categories and those prompts cannot be coalesced.

The WIT files define the intended public semantics. The current Swift provider
functions are native qualification adapters, not WIT-lowered Wasm components.
They are statically registered to prove that App capability growth changes the
Lib/profile side without adding domain APIs to the Host. The validator pins the
fixed Host SHA-256 while the profile grows from six to thirteen providers.

Set `WASMC_IOS_AUTHORIZATION_SCENARIO=contacts-granted` to have the harness use
Simulator privacy control to grant Contacts before launch. The authorization
Lib must then observe `authorized` and the independent Contacts Lib must perform
the real create/fetch/delete roundtrip. `observe-only` resets Contacts and proves
that the Contacts Lib does not attempt use while the state is `not-determined`.

`scripts/validate-ios-app-capability.mjs` is the portable source/WIT gate.
`scripts/test-ios-app-capability.mjs` is the macOS gate and requires
`WASMC_IOS_SIMULATOR_UDID` to name one booted iOS Simulator. The dynamic gate
generates and signs the app, installs and launches it, reads the report from its
data container, validates every provider result and captures an outer frame.

This laboratory does not qualify a physical iPhone, Component loading,
background execution, or protected camera, audio, location, motion and
notification capabilities. It is not admitted, catalogued or released.
