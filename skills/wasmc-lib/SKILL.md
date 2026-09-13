---
name: wasmc-lib
description: Consume reviewed WAsmC WIT Lib packages with exact provider identity and typed application APIs. Use for standard or standalone Lib selection, linking and lifecycle, not private compiler maintenance.
---

# WAsmC Lib consumer

WIT is semantic authority. Reuse the selected package's ordinary typed APIs;
private handles, status lanes and lifecycle helpers are not application APIs.
CoreLib owns managed storage. A provider version is not interchangeable with
another provider just because its version number is newer.

Read [the Lib consumer reference](../wasmc-developer/references/lib.md) for
managed applications and [LIB.md](../../LIB.md) for the Core/Component boundary.
The standard package is discoverable at
[its Skill](../../standard/wasmc-std/1.4.0/SKILL.md).

On supplemental main, use [the catalog](../../catalog/README.md) for exact
selection and [installation](../../catalog/INSTALL.md) for pinned bytes.
Selection and installation do not grant Host authority or establish engine
support. Check [artifact compatibility](../../compatibility/README.md) before
instantiation. Std1.4.0 requires function-references and tail-call; do not claim
Wasmi or Node18 standard execution from compiler-only success.

Use [the paired executable](../../examples/current/standard.mjs) to verify the
WAsmC/Rust callers against the same Std and provider. Component portability is
a separate deployment path, not shared memory between independent Components.
Public third-party build/publish is not yet closed; do not infer a shipped
command from authoring design documentation.
