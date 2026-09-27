# iOS app-internal capability laboratory

This XcodeGen project qualifies what one ordinary embedded iOS application can
do while keeping its Host domain-neutral. `Host/FixedHost.swift` validates and
invokes opaque byte providers. `Profile/EmbeddedProfile.swift` is the only
deployment control plane that selects domain providers. Apple frameworks and
system calls are confined to `Providers/`.

The current simulator slice exercises eleven provider families:

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
  notification and background-refresh availability/authorization.

The protected-capability provider never requests permission. `available=false`
on Simulator is retained as a platform observation, not reported as a Host or
Lib failure. Permission prompts, actual sensor samples and background delivery
belong to explicit physical-device and lifecycle qualifications.

The WIT files define the intended public semantics. The current Swift provider
functions are native qualification adapters, not WIT-lowered Wasm components.
They are statically registered to prove that App capability growth changes the
Lib/profile side without adding domain APIs to the Host. The validator pins the
fixed Host SHA-256 while the profile grows from six to eleven providers.

`scripts/validate-ios-app-capability.mjs` is the portable source/WIT gate.
`scripts/test-ios-app-capability.mjs` is the macOS gate and requires
`WASMC_IOS_SIMULATOR_UDID` to name one booted iOS Simulator. The dynamic gate
generates and signs the app, installs and launches it, reads the report from its
data container, validates every provider result and captures an outer frame.

This laboratory does not qualify a physical iPhone, Component loading,
background execution, or protected camera, audio, location, motion and
notification capabilities. It is not admitted, catalogued or released.
