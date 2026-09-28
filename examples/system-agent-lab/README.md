# System Agent Lab

This is the ecosystem integration layer for composing multiple exact System
Libs into one platform App. It complements, and does not replace, focused
Lib-owned qualification examples.

The current iOS composition selects:

- `wasmc-system-ios-app-surface-control` for real WKWebView semantic
  observation and targeted DOM actions;
- `wasmc-system-ios-network-path` for live `NWPathMonitor` observation.

Run the structural/build gate:

```sh
node scripts/validate-system-agent-lab.mjs
```

Run the iOS Simulator integration gate with one exact booted Simulator:

```sh
WASMC_IOS_SIMULATOR_UDID=6164D245-822A-4F9C-9B70-327FB306DE06 \
  node scripts/test-ios-system-agent-lab.mjs
```

The lab is qualified architecture work only. It is not admitted, released,
discoverable or installable.

