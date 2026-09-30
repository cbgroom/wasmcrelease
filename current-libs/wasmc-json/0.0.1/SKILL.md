---
name: wasmc-json
description: "Bounded JSON compact, validation and parse-once pointer selection backed by pinned serde_json without external authority."
metadata:
  wasmc:
    version: "0.0.1"
    parent_skill: "wasmc-lib"
---

# Lib usage

Parent ecosystem Skill: `wasmc-lib`.
Read `lib.wit` and `references/agent-delta.json`.
Reuse WIT and mature ecosystem knowledge; learn only declared deltas.

## Agent views

### Runtime
Default for WAsmC generation and execution. Read `lib.wit` as the complete semantic authority and prefer the shortest correct public operation for the task. Do not preload Rust implementation details.

### Developer
Use when developing, extending, or composing the Lib. Includes Runtime semantics plus complete WIT, Rust implementation, lifecycle, build, diagnostics, and composition details. Preserve the Runtime WAsmC path when evolving the Lib.
