# Lib Refresh V2 source authority

Author a library as four files: `lib.json`, `lib.wit`, `delta.rs`, `adapter.rs`.
Ordinary Rust algorithms belong in `delta.rs`; `adapter.rs` maps WIT-facing
types and delegates. Cargo projects, bindgen entrypoints, Core/Component roots,
SDKs and build receipts are generated, never hand-maintained per library.

The current implementation supports **value** libraries. Resource, Host-backed
and contract-only profiles are not yet implemented; the executor rejects them
instead of using old `libsrc` projects as a fallback.

## Working commands

Supply the reviewed producer as an absolute path in `WASMC_LIB_PRODUCER`.
Rust/Cargo must be available on PATH; `rust-policy.json` selects the exact
toolchain and dependency policy. Normal builds use the single committed
`Cargo.lock` with offline, locked Cargo execution.

```sh
node scripts/validate-lib-refresh-v2-source.mjs
node --test scripts/test-lib-refresh-cache-v2.mjs scripts/test-lib-refresh-workflow-v2.mjs
node scripts/lib-refresh-v2.mjs --producer "$WASMC_LIB_PRODUCER" --all
node scripts/lib-refresh-v2.mjs --producer "$WASMC_LIB_PRODUCER" wasmc-data-core
node scripts/lib-refresh-v2.mjs --producer "$WASMC_LIB_PRODUCER" --rebuild wasmc-data-core
```

`--cache` selects a persistent workspace/target/object store; `--out` selects
evidence storage. Each invocation creates a new `runs/refresh-*` directory.
The final JSON prints its exact `run_root`. Supply that root to the ten-library
behavior suite:

```sh
node scripts/qualify-lib-refresh-v2.mjs --run-root "$RUN_ROOT"
```

Do not reuse a previous successful run's receipt for changed inputs. A cache
hit verifies every generated file against its sealed inventory. Missing,
altered or extra files reject rather than silently rebuilding over evidence.
Completed package entries survive an interrupted later package; retry the same
request after confirming no live writer remains. A retained writer.lock must
be inspected before recovery, never blindly removed.

## Invalidation

No-change refresh reuses verified package roots. A delta-only change rebuilds
that library. WIT dependencies are type dependencies: a sibling's Rust delta
is not linked into the importing library and does not invalidate it. Changing
dependency WIT, a used shared adapter, the lock, policy or producer changes the
appropriate identity. Changed generator bytes invalidate artifact reuse but
do not by themselves relocate the stable Cargo workspace.

## Qualification boundary

Q0 is build/Root integrity. Q1 here is behavior of the generated import-free
Core artifacts under Node: all 28 exported APIs of ten migrated libraries have
explicit tests. The suite includes six data types, 64-bit extremes, nulls,
zero-column/zero-row batches, error recovery, retained memory, grouping/window
operations, IPC/Parquet round trips, CSV, JSON, gzip and HTTP1 boundaries.

This does not imply ordinary WAsmC caller, generated Component SDK or
multi-engine Q2 qualification, nor Q3 release/admission. The 10,000-row profile
case is Core artifact semantics, not the earlier WAsmC managed-graph benchmark.

## Remaining migration

The new refresh path never reads old `libsrc` authoring projects. The old trees
and their test/CI entrypoints still exist as migration evidence; remove them
together after redirecting their full oracle/engine jobs to generated roots.
Do not add a second supported format, fallback or compatibility branch. Do not
rewrite immutable released packages to perform source migration.
