# WAsmC Host

This directory is the public, cross-platform Host subsystem for WAsmC.

The canonical architecture is:

1. `contract/` — stable public Host ABI and WIT authority.
2. `core/` — platform-independent Host policy and protocol logic.
3. `runtime/` — Resource / Operation / Completion / Window execution machinery.
4. `drivers/` — capability-oriented driver contracts.
5. `platform/` — operating-system and device adapters.
6. `embedding/` — execution environments carrying/bridging Host providers.
7. `sdk/` — distribution and developer integration packages only.
8. `examples/`, `tests/`, and `qualification/` — examples, reusable tests, and qualification evidence.

The public Host uses only this canonical tree. Former experimental top-level layouts have been moved into these roots; no compatibility aliases are retained. Historical admission/evidence may still mention their original paths.

The Host semantic model remains:

`Capability -> Resource -> Operation -> Completion -> Window`.

Platform adapters must not introduce platform-specific guest-visible Host APIs.
Differences are represented through capability/resource availability.
