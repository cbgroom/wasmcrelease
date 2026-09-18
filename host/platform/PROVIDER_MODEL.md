# Platform provider bindings

Platform directories bind canonical Host capability drivers to operating-system
execution environments. They do not create platform-specific Guest APIs.

Provider code is shared whenever a stable language/runtime abstraction already
captures the required OS behavior. For example, the public storage provider
uses the same Rust `std::fs::File` implementation on Linux, macOS and Windows;
duplicating three wrappers would add maintenance cost without adding platform
semantics.

OS-specific code belongs under `platform/<os>/` only when the capability
actually needs OS-specific acquisition, lifecycle or native APIs. Memory
mapping/shared-memory, camera, display, GPU and NPU are typical examples.

Each `providers.json` is qualification metadata, not authority. A provider may
be marked `qualified` only when:

1. its implementation path exists in this repository;
2. its qualification workflow exists;
3. the platform/architecture scope is explicit;
4. the provider uses the canonical Host contract/runtime/driver semantics.

Provider status is three-state:

- `unimplemented`: no canonical implementation is claimed;
- `implemented`: code exists but platform qualification is incomplete;
- `qualified`: implementation plus qualification workflow and architecture
  scope are present.

Platforms never inherit support claims from another OS merely because shared
code compiles there.

Every platform manifest must list every canonical capability exactly once.
Absence is not a support state. New capabilities therefore force an explicit
per-platform decision: unimplemented, implemented, or qualified.

Remote is not a canonical capability and must not appear in platform manifests.
Local versus remote is Host-private provider/backing locality; the semantic
capability remains file, memory, TCP, UDP, camera, accelerator, and so on.
