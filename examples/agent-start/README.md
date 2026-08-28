# Agent start examples

Run all examples from the repository root:

```bash
node examples/agent-start/run.mjs
```

Read them in numeric order. They introduce a complete package, scalar control
flow, a private function, a structured record lowered to Core lanes, and one
explicit Host import. The runner compiles every source with the published
compiler, rejects unexpected imports, instantiates it, and checks exact output.

See [`../../LANGUAGE.md`](../../LANGUAGE.md) before generating a larger direct
Core-lane program. If the task needs strings, lists, maps, or managed objects,
read [`../../LIB.md`](../../LIB.md) and the bundled developer Skill; managed
source is public through `compileLib` and `instantiateLib` in `v0.0.3`.
