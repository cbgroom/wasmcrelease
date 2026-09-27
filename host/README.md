# WAsmC Host

This directory is the public, cross-platform Host subsystem for WAsmC. The
current architecture workstream moves all domain semantics into exact Lib
packages and keeps the Host as a fixed, domain-neutral boundary.

The canonical architecture is:

1. `contract/` — domain-neutral physical boundary mechanisms and retained v0 contracts.
2. `core/` — platform-independent ownership and lifecycle invariants.
3. `runtime/` — Resource / Window / Operation / Completion execution machinery.
4. `drivers/` — retained v0.0.15 domain fixtures pending Lib migration.
5. `platform/` — native execution of Lib-owned physical descriptors.
6. `embedding/` — environment execution of the same fixed boundary.
7. `sdk/` — distribution and developer integration packages only.
8. `examples/`, `tests/`, and `qualification/` — examples, reusable tests, and qualification evidence.

The public Host uses only this canonical tree. Former experimental top-level layouts have been moved into these roots; no compatibility aliases are retained. Historical admission/evidence may still mention their original paths.

The target Host semantic model is:

`ExternalTarget -> Resource -> Window -> Operation -> Completion`.

Exact Lib WIT owns file, process, network, service, protocol and device
semantics. Platform/embedding code must not introduce domain-specific
guest-visible Host APIs. Read
[`docs/HOST_LIB_DEFINED_BOUNDARY.md`](../docs/HOST_LIB_DEFINED_BOUNDARY.md)
before extending Host code.
