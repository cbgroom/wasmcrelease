---
name: wasmc-host-clock
description: "A WIT-native Rust Lib that forwards one explicit Host clock capability."
metadata:
  wasmc:
    version: "0.0.1"
---

# Lib usage

Read `lib.wit` and `references/agent-delta.json`.
Reuse WIT and Rust knowledge; learn only declared deltas.
Use snake_case in wasmc and kebab-case at WIT boundaries.
Call only supported APIs. Bind only exact declared Host authorities.
Never use provider handles, plans, private lanes, or artifact tiers in source.
