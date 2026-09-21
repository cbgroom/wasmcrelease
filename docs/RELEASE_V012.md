# WAsmC v0.0.12 SDK/Agent integration release

v0.0.12 promotes the public Rust Host SDK candidate, SDK/Runtime/CLI Agent
Skills, product-surface discovery, cross-platform SDK qualification, and layered
performance baselines without changing the admitted compiler or Lib product
bytes.

## Immutable product identity

- Product candidate: `channels/candidates/0.0.12.json`
- Product set SHA-256:
  `a5629a5630a4b5d247ef1d43c0f488d8d865a478939d15d0abc72c275e6be1ad`
- Compiler source authority:
  `e69abb73f667f3810b0c40937fd1a1e2d04d4255`
- Lib source authority:
  `df8416ea68b3ee32cb0c3d7c18028b08d9c22a6e`

The dev, main and prod tags must contain this same product set. Existing tags
remain immutable and only suffix-free prod advances the latest pointer.

## Main release surfaces

- `sdk/wasmc-core-runtime`: published dual-engine Core Runtime SDK.
- `sdk/wasmc-host`: generic Rust Host embedding SDK with
  Minimal/Safe/Development binding policies, explicit grants, and
  `BindingReport`.
- `sdk/wasmc-native-compiler`: source-free Wasmi run / Wasmtime AOT native CLI
  integration.
- SDK discovery and component Skills route zero-context Agents by task intent
  and exact release status.
- Lightweight Node/Bun/Deno embedding remains a qualified-reference surface.
- Native Runtime Library remains incubating and is not advertised as a packaged
  `.so/.dylib/.dll` asset.

## Runtime policy

Wasmi provides immediate completion on a cold or missing-cache path while
bounded background Wasmtime preparation may create a faster route for later
fresh invocations. A running invocation is never migrated or replayed. Prepared
modules, persistent target-local AOT bytes and safe Store/Instance pools are
cache layers of the same routing model, not new guest APIs.

## Qualification model

Required release evidence includes:

- SDK Agent guidance and route/source-symbol validation;
- Core Runtime SDK behavior;
- generic Host SDK behavior and native example;
- native CLI behavior;
- six-platform Rust Host SDK qualification, with Intel macOS retained as
  legacy-optional release coverage;
- existing Host/Lib end-to-end and source-free consumer qualification;
- platform-relative performance baselines as observational evidence only.

Performance differences are not release failures unless a metric is explicitly
promoted to a hard gate. Functional correctness, identity, expected status and
required-platform presence remain hard gates.

## Promotion

The accepted sequence is `v0.0.12-dev.1` -> `v0.0.12-main.1` ->
`v0.0.12`. Promotion reuses the exact candidate product digests and never
rebuilds or moves an existing tag.
