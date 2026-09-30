---
name: wasmc-lib-search
description: "Read-only discovery over a digest-pinned immutable release Lib snapshot. Search is not dependency selection or installation."
metadata:
  wasmc:
    version: "0.4.0"
    parent_skill: "wasmc-lib"
---

# Lib usage

Parent ecosystem Skill: `wasmc-lib`.
Read `lib.wit` and `references/agent-delta.json`.
Reuse WIT and mature ecosystem knowledge; learn only declared deltas.

## Agent views

### Runtime
Default for WAsmC generation, execution, and ordinary Lib consumption. Read `lib.wit` as the complete semantic authority and prefer the shortest correct public operation. Do not preload Rust implementation, build, provider ABI, or developer diagnostics.

### Developer
Use for Lib authoring, extension, composition, public WIT evolution, or Rust integration. Includes Runtime semantics plus complete WIT, Rust/build/lifecycle/diagnostic context. Preserve the Runtime WAsmC path when evolving the Lib.

