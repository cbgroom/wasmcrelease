---
name: wasmc-developer
description: Design, write, compile, inspect, embed, and debug applications with released wasmc, WIT-shaped source and libs, JavaScript/WebAssembly, or Rust/Wasmtime. Do not use for maintaining the private compiler repository.
---

# wasmc Developer

Build against the released files beside this Skill. Never assume private source
or an unreleased capability.

## Start

1. Reuse WIT and Rust knowledge; learn only the wasmc deltas.
2. For a package-manager-free compiler/runtime bootstrap read [runtime.md](references/runtime.md).
3. For ordinary code read [language-and-wit.md](references/language-and-wit.md).
4. For managed String/List/Map/record/resource code also read
   [lib.md](references/lib.md).
5. To expose a reviewed Rust crate as a Lib, read
   [authoring-libs.md](references/authoring-libs.md).
6. For execution read either [javascript.md](references/javascript.md) or
   [rust-wasmtime.md](references/rust-wasmtime.md).
7. Compile the smallest complete program, validate the Wasm, and inspect every
   import before adding Host bindings.

## Mental model

- WIT owns public packages, interfaces, worlds, values, and resources.
- Rust supplies familiar expressions, control flow, methods, move/clone,
  Option, and Result where documented.
- wasmc supplies a small deterministic delta and emits standard Core Wasm.
- A WIT lib owns identity-bearing managed values and reusable algorithms.
- The Host owns every external effect; an import is a request, not authority.

Use snake_case in `.wasmc`; public WIT names map to kebab-case. Never expose
lib handles, plans, Store nonces, lifecycle helpers, or private lanes in
application source.

## Repair loop

Use native `--json-errors` and its category, source range, and fix_hint. Do not
repair by adding undeclared imports or weakening a Host allowlist. The packaged
capability contract and actual compiler result outrank historical examples.
