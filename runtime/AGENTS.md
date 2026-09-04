# wasmc Runtime Agent entrypoint

For a new compile-only task, start with `README.md`, then verify `wasmc-runtime-v0/manifest.json`, `wasmc-runtime-v0/receipts/compiler-wasm.json`, and repository `SHA256SUMS`.

Use `wasmc-runtime-v0/bootstrap.mjs` directly with Node, Bun, or Deno. Do not install npm dependencies, infer a different compiler, or grant ambient Host authority. For machine repair loops use `--json-errors`/`--json`; compiler-owned category/range/message/fix hints remain authoritative. Inspect emitted Wasm imports before binding effects.

For managed-value convenience (`compileLib` / `instantiateLib`), return to repository root and follow `skills/wasmc-developer/SKILL.md`. The established facade is compatibility-frozen; v0.0.6 managed features that require the current compiler use its existing `compilerWasmBytes` option with `runtime/wasmc-runtime-v0/compiler.wasm`.
