# Runtime and registry

Use `runtime/wasmc-runtime-v0` when the task is to compile `.wasmc` to standard Core Wasm without installing a JavaScript package.

```bash
cd runtime/wasmc-runtime-v0
node bootstrap.mjs self-test
node bootstrap.mjs compile --input examples/add.wasmc --output /tmp/add.wasm
```

The compiler is `compiler.wasm`. `bootstrap.mjs` selects a thin Node, Bun, or Deno Host adapter. Compiler semantics remain in Core Wasm; Host adapters only provide bounded filesystem/process integration required by the CLI surface.

Before activation, verify `manifest.json`, `receipts/compiler-wasm.json`, and the repository `SHA256SUMS`. The repo-local package descriptor and resolver metadata live in `runtime/registry-v0` and require no npm or external JavaScript package registry.

The registry's internal `dev` label is local resolver metadata for `wasmc:runtime@0.1.0-runtime-v0`. When using the public release, the immutable outer Git tag or full commit is the publication identity.

Use the legacy `dist/wasmc.mjs` compatibility facade only when its richer convenience API such as `compileLib`/`instantiateLib` is useful. v0.0.5 intentionally keeps the v0.0.4 compatibility trees byte-identical while adding the newer Runtime path.
