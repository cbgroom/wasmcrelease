# wasmc Runtime Agent entrypoint

For a new compile-only task, start with `README.md`, then verify `wasmc-runtime-v0/manifest.json` and `wasmc-runtime-v0/receipts/compiler-wasm.json`.

Use `wasmc-runtime-v0/bootstrap.mjs` directly with Node, Bun, or Deno. Do not install npm dependencies, infer a different compiler, or grant ambient Host authority. Inspect emitted Wasm imports before binding effects.

If the task needs the established managed-value convenience facade (`compileLib` / `instantiateLib`), return to repository root and follow `skills/wasmc-developer/SKILL.md`; the v0.0.4 compatibility facade remains intentionally byte-identical in v0.0.5.
