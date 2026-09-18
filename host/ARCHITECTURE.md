# Host architecture

## Authority boundary

`contract/` is the only guest-facing ABI authority. Platform implementations
must implement that contract rather than fork it.

The following semantics are cross-platform invariants:

- timeout is observation only and is not cancellation;
- cancellation is a request, not proof that an external effect was undone;
- ambiguous admission or lost authoritative result is `OutcomeUnknown`;
- results are claimed exactly once;
- Resource identity is distinct from transport/address identity;
- guest code never receives file descriptors, native pointers, IP/port authority,
  backend tokens, or device addresses.

## Layering

```text
contract
   ↓
core
   ↓
runtime
   ↓
drivers
   ↓
platform
   ↓
OS / device API
```

`core` and `runtime` should remain portable Rust/Wasm-oriented code.
`platform` is the only place where AVFoundation, V4L2, Win32, Android NDK,
Harmony native APIs, Metal, NPU APIs, and similar platform specifics belong.

## Packaging

Desktop targets may ship a runtime library/executable bundle.
Mobile targets primarily ship embeddable SDK packages.

All packages contain the same contract identity and declare the capabilities
actually implemented/qualified on that platform.
