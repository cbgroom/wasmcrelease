# wasmc package guidance

Use the bundled [`wasmc-developer` Skill](skills/wasmc-developer/SKILL.md) for
every task that designs, writes, compiles, inspects, embeds, or debugs `.wasmc`
programs. Read that file completely, then open only the references it routes to
for the selected runtime and value model.

Treat this package as the complete capability boundary:

- use only the compiler, libs, APIs, and guidance shipped together;
- never assume access to the private compiler repository or unreleased syntax;
- inspect generated Core Wasm imports before granting Host capabilities;
- keep external effects in explicit Host bindings;
- report an unsupported capability instead of inventing an ABI or JSON bridge.

For a first program, compile with `node cli.mjs input.wasmc output.wasm`, then
instantiate the emitted standard Core Wasm with native WebAssembly or Wasmtime.
