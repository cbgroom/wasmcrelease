---
name: wasmc-native-cli
description: Use the source-free WAsmC CLI to run its supported import-free App profile, emit portable Core Wasm, or build a target-local Wasmtime AOT executable and cache.
parent_skill: wasmc-sdk-discovery
---

# WAsmC native CLI

Use this when the task is command-line compilation/execution rather than
embedding the Rust runtime as an SDK.

Read `release.json` and `channels/prod.json` for the exact published version.
Download your platform package from the matching [GitHub Release](https://github.com/cbgroom/wasmcrelease/releases)
and check it against `NATIVE-SHA256SUMS`. GitHub Actions artifacts carry qualification evidence.

## Current commands

```bash
wasmc run INPUT.wasmc [scalar-arg ...]
wasmc build INPUT.wasmc -o OUTPUT.wasm
wasmc build --target native INPUT.wasmc -o EXECUTABLE
```

The roles are intentionally different:

- `run` compiles the source and executes the documented import-free scalar App
  profile through Wasmi for low cold-start overhead.
- `build` emits portable App Core Wasm.
- `build --target native` builds/reuses a target-local Wasmtime AOT cache and
  emits a standalone executable.

Do **not** tell users that this CLI automatically performs the
`CoreRuntimeSdk` background promotion flow. That behavior belongs to the
embeddable runtime SDK unless/until a later CLI release explicitly integrates
it.

Native cache bytes are rebuildable target/toolchain/configuration derivatives,
not portable package identity. The CLI refuses unresolved imports in its
current `run` profile; use an embedding SDK/Host path for a broader Host
surface.

## Verify this checkout

```bash
cargo +1.96.0 test --locked --manifest-path sdk/wasmc-native-compiler/Cargo.toml
```

Use the README's executable examples for run/build/native-build behavior on the
current candidate.
