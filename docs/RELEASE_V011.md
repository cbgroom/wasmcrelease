# WAsmC v0.0.11 release

v0.0.11 adds seven admitted Data Foundation v1 Lib packages while preserving
the existing compiler, CoreLib, Host ABI, lifecycle and no-replay contracts.

## Immutable product identity

- Product candidate: `channels/candidates/0.0.11.json`
- Product set SHA-256:
  `101a8a3783d52fc3d06e15731b20ec5fbe5a2bdbd7d9e964876f76ce44e33662`
- Compiler source authority:
  `e69abb73f667f3810b0c40937fd1a1e2d04d4255`
- Data Lib source authority:
  `df8416ea68b3ee32cb0c3d7c18028b08d9c22a6e`

The dev, main and prod tags must contain this same product set. Existing tags
remain immutable and only suffix-free prod advances the latest pointer.

Dev qualification at source `86b8777cc616fc4222561bde21e3c33ae6f47418`
passed Data Foundation, public Lib source, Library-first guidance, all 12
LibSearch jobs and all 22 source-free consumer jobs.

The exact immutable dev tag `v0.0.11-dev.1` at
`532c0e413104786a46e3b9cf0ebafb16de55626a` was then requalified: all 11
tag-triggered LibSearch jobs and all 22 manually dispatched source-free
consumer jobs passed. Those receipts authorize `v0.0.11-main.1`.

Final prod identity is `v0.0.11` (no suffix), with the identical candidate
product digest. Only prod advances `package-index.json.latest`; every earlier
tag remains immutable.

## Admitted Data Libs

Each package is version `0.0.1`, has zero Core Wasm imports and contains only
the six canonical source-free package files.

- `wasmc-data-core`
- `wasmc-csv`
- `wasmc-data-expr`
- `wasmc-data-compute`
- `wasmc-data-relational`
- `wasmc-data-profile`
- `wasmc-data-interchange`

The qualified pipeline is CSV → Data Core/types → Expr → Compute → Relational
→ Profile → Arrow IPC/Parquet → Data Core validation. Its retained oracle is
`id > 1` → `[2,3]` → count 2, sum 5, mean 2.5 → validation PASS.

Relational v1 includes union-all, bounded typed inner/left equi-join,
deterministic row-number/rank/dense-rank windows, deterministic group
aggregation, first/last and population variance/stddev. Lag/lead, frame
aggregates and distinct are deferred to v1.1. SQL/DB is not part of this
release.

## Verification

```sh
node scripts/release-candidate.mjs verify channels/candidates/0.0.11.json
node scripts/validate-libs.mjs
node scripts/validate-libsrc.mjs
node scripts/review-data-admission.mjs
node scripts/test-data-pipeline.mjs
./scripts/validate-maintainer.sh
```
