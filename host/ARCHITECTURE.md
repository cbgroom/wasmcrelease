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
provider selection
   ├── platform  → OS / device API
   └── embedding → Node / Deno / Bun / Browser environment API
```

`core` and `runtime` should remain portable Rust/Wasm-oriented code.
`platform` is the only place where AVFoundation, V4L2, Win32, Android NDK,
Harmony native APIs, Metal, NPU APIs, and similar platform specifics belong.

## Packaging

Desktop targets may ship a runtime library/executable bundle.
Mobile targets primarily ship embeddable SDK packages.

All packages contain the same contract identity and declare the capabilities
actually implemented/qualified on that platform.

## Public consumption and extension surfaces

The Host contract is shared by multiple product surfaces. Packaging does not
create a second guest ABI.

Consumer surfaces:

- Lib Package: reusable Core/Component functionality under `libs/`.
- Host SDK: programmable embedding, currently `sdk/wasmc-host` plus the Core
  Runtime SDK.
- Integrated Runtime / CLI: compiler, runner, Host and registry as an
  open-the-box product.
- Lightweight Embedding: Node/Bun/Deno/Browser use the surrounding runtime as
  the OS bridge.
- Native Runtime Library / Platform SDK: native shared runtime and platform
  packaging for the shortest high-performance data path.

Extension surfaces:

- Driver / Provider: adds physical capability behind generic Resources.
- Remote Provider: changes backing locality without creating RemoteFile,
  RemoteMemory or parallel guest capability families.

The product-level map is `docs/ASMD.md` and the machine-readable release
inventory is `release-surfaces.json`.

## Orthogonal execution dimensions

`platform/` and `embedding/` are orthogonal.

- platform answers where native Host code runs: Linux/macOS/Windows/Android/Harmony/iOS.
- embedding answers which execution environment carries or bridges Host providers: native/Node/Deno/Bun/Browser.

Node, Deno, Bun and Browser are never platform adapters and never define guest-visible Host ABI variants. Provider selection remains an internal Host decision; Guest code sees only canonical Capability/Resource/Operation/Completion/Window semantics.

## Provider maturity

Provider support is intentionally three-state:

- `unimplemented`: no canonical provider implementation is claimed.
- `implemented`: canonical provider code exists, but the platform support claim
  is not yet backed by the required qualification evidence.
- `qualified`: implementation, workflow evidence and architecture scope are
  all present and validated.

This avoids treating "code exists" as equivalent to "platform supported".

The machine-readable architecture contract is `host/architecture.json`.
Provider implementations may live only under `host/drivers/` (shared
capability providers) or `host/platform/` (genuinely OS-specific providers).
`embedding/`, `sdk/`, tests and qualification evidence are not provider
implementation roots.

## Cold path versus hot path

Namespace discovery, capability admission and provider/platform/embedding
selection are cold-path concerns. Once a Resource is resolved, hot-path
execution uses opaque Resource/Operation/Completion/Window state only. Provider,
platform and embedding identity must not leak into Guest-visible authority.

## Resource semantic kind versus locality

Resource semantics and backing locality are independent dimensions.

- semantic capability answers what the Resource is: file/storage, memory, TCP,
  UDP, camera, accelerator, and so on;
- locality answers where/how its provider is reached: local or remote.

Remote is therefore not a canonical capability. A remote file remains a file
capability backed by a remote provider; remote memory remains memory. Route,
session and remote-object identity stay Host-private provider state.

This prevents parallel RemoteFile/RemoteMemory/RemoteCamera capability trees and
keeps local and remote providers on the same Resource/Operation/Completion/Window
contract.
