# WAsmC SDK Agent entrypoint

Read the repository-root `AGENTS.md` first, then
`skills/wasmc-sdk-discovery/SKILL.md`.

Do not choose an SDK by directory name alone. The immutable release identity and
`release-surfaces.json` (when present) determine whether a surface is
published, candidate, qualified-reference, incubating, or architecture-only.

## SDK routes

- `wasmc-core-runtime/`: engine SDK. Wasmi immediate path, async Wasmtime
  preparation, explicit promotion/rollback, fresh-Store invocation and
  no-replay semantics. Read its `SKILL.md`.
- `wasmc-host/`: generic Rust Host embedding SDK. Adds resource registration,
  platform binding policies and `BindingReport`. Read its `SKILL.md`.
- `wasmc-native-compiler/`: source-free CLI/native build integration. Its
  `run` path and native-build path have deliberately different runtime roles.
  Read its `SKILL.md`.

Never infer a packaged native runtime library from `host/runtime` source, and
never describe a candidate SDK as part of an older immutable release.
