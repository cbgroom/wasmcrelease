# System Agent Lab

This is the ecosystem integration layer for composing multiple exact System
Libs into one platform App. It complements, and does not replace, focused
Lib-owned qualification examples.

The current iOS composition selects:

- `wasmc-system-ios-app-surface-control` for real WKWebView semantic
  observation and targeted DOM actions;
- `wasmc-system-ios-network-path` for live `NWPathMonitor` observation.

The Android composition selects the exact display, semantic UI, shell input and
direct uinput providers from the resolved Android Library OS profile. iOS and
Android share the same composition/conflict engine while retaining different
physical build and runtime gates.

Run the structural/build gate:

```sh
node scripts/validate-system-agent-lab.mjs
```

Run the iOS Simulator integration gate with one exact booted Simulator:

```sh
WASMC_IOS_SIMULATOR_UDID=6164D245-822A-4F9C-9B70-327FB306DE06 \
  node scripts/test-ios-system-agent-lab.mjs
```

Run the Android composition and Emulator gates:

```sh
node scripts/validate-android-system-agent-lab.mjs
node scripts/test-android-system-agent-lab.mjs
```

The lab is qualified architecture work only. It is not admitted, released,
discoverable or installable.
