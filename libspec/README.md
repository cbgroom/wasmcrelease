# Current Lib authoring

`registry.json` is the complete current candidate list. There is one source
format, one refresh entry and no historical authoring fallback.

Rust libraries keep `lib.json`, `lib.wit`, ordinary Rust `delta.rs`, and a thin
`adapter.rs`. One cohort Cargo policy/lock generates all crate scaffolding.
`value` emits complete canonical Core and Component SDK views; `resource`
emits the complete views actually supported, never an empty Core SDK claim.
Declared Host imports remain explicit, for example TLS entropy.

Physical platform libraries use `native` with a WIT, manifest and explicitly
listed C/Swift/Node payloads. Native code is not rewritten as fake portable
Wasm. On a matching platform the refresh builds a binary; otherwise it seals
the source package and reports `embedded_source_packaged`. Syntax checking,
compilation, runtime behavior and device qualification are separate facts.

```sh
node scripts/validate-current-only-libs.mjs
node scripts/validate-lib-refresh-v2-source.mjs
node --test scripts/test-lib-refresh-cache-v2.mjs scripts/test-lib-refresh-workflow-v2.mjs
node scripts/lib-refresh-v2.mjs --producer "$WASMC_LIB_PRODUCER" --all
node scripts/lib-refresh-v2.mjs --producer "$WASMC_LIB_PRODUCER" wasmc-data-core
node scripts/lib-refresh-v2.mjs --producer "$WASMC_LIB_PRODUCER" --rebuild wasmc-data-core
node scripts/qualify-lib-refresh-v2.mjs --run-root "$RUN_ROOT"
```

The producer must be an explicit absolute executable path, bound by SHA256 in
the receipt. Normal builds are offline/locked. `--update-lock` is an explicit
cohort dependency change, not a silent retry when a normal build fails.

`--cache` selects persistent workspaces, Cargo targets and sealed artifacts.
`--out` selects independent evidence runs. Always use the returned `run_root`;
never choose a cached package just because its directory exists. A tampered,
missing or extra file is an error, not a reason to overwrite old evidence.

Tests load generated packages through `generated-lib-v2.mjs`; preserved oracle
fixtures live under `tests/lib-refresh`, not in a second authoring tree.
Platform profile requests select exact current source identities. They do not
inherit old qualification flags or make a source package executable.

No-change refresh verifies/reuses artifacts. A delta change rebuilds that
library. WIT dependencies are type dependencies: a sibling's Rust delta is not
linked into a consumer merely because its WIT types are reused. Shared module,
dependency lock, policy, producer and generator identities participate in the
appropriate cache keys. Fuel is diagnostic-only, not a workload admission gate.

The original per-library Cargo projects and duplicate build/admission commands
are retired. Git history and immutable release/oracle records remain historical
evidence, not active routes. Future releases require Q2 ordinary WAsmC/SDK/engine
verification and Q3 candidate, legal, determinism and installed-use acceptance.
