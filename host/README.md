# WAsmC Host

This directory is the public, cross-platform Host subsystem for WAsmC.

The canonical architecture is:

1. `contract/` — stable public Host ABI and WIT authority.
2. `core/` — platform-independent Host policy and protocol logic.
3. `runtime/` — Resource / Operation / Completion / Window execution machinery.
4. `drivers/` — capability-oriented driver contracts.
5. `platform/` — operating-system and device adapters.
6. `sdk/` — application-ecosystem embedding packages.
7. `examples/`, `tests/`, and `qualification/` — examples, reusable tests, and platform evidence.

Existing directories such as `v0/`, `completion/`, `tcp/`, `udp/`,
`file-io/`, and `lib-e2e/` are retained as compatibility/research roots.
They will migrate incrementally according to `MIGRATION.md`; no compatibility
path is removed by introducing this layout.

The Host semantic model remains:

`Capability -> Resource -> Operation -> Completion -> Window`.

Platform adapters must not introduce platform-specific guest-visible Host APIs.
Differences are represented through capability/resource availability.
