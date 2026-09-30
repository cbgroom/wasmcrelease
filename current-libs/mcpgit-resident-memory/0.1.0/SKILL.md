---
name: mcpgit-resident-memory
description: "A pure-memory revisioned aggregate and content store with immutable snapshots, CAS publication, bounded history, range reads and explicit memory budget."
metadata:
  wasmc:
    version: "0.1.0"
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

