# Lib Refresh V2

## Current activation: ten-library closure (2026-10-06T17:47:57Z)

Human requested continued implementation with no legacy compatibility. Live
release worktree HEAD/upstream is 1010232452e02602d0c951609caeec4a377e77dc.
Six Data libraries, CSV, shared data-arrow and the generator/policy/lock changes
are owned workstream changes from the preceding session. Preserve and checkpoint
them before further edits. No other release changes or staged files were found.
The separate producer cache branch is clean and synced at
15418b27ef663dd4f456e2d46b077e2278c2c639. Original compiler HTTP1/Interchange WIP
is outside this workstream and must not be staged or reset.

Current evidence: nine-library cohort A has Q0 PASS, CSV has separate Q0 PASS,
and the new producer Data Core/Compute pair has Q0 PASS. Ten-library cohort B
has no complete receipt and no live process; it is interrupted/unqualified, not
running and not PASS. New Data/CSV Q1 and all Q2/Q3 remain open.

Preflight: exact hwlinux hostname/user/HEAD/branch/upstream, staged/unstaged/
untracked and recent commits checked; 175GiB free; no active writer. Read the
current release-lib-refresh-v2 Skill. YXSGIT task index still describes the old
JSON-only stage; revision-fenced checkpoint attempts encountered concurrent
main updates. This activation and current human instructions supersede that
older next-action text, not its historical evidence.

First executable action: checkpoint migration, then separate a persistent Cargo
workspace/cache from immutable evidence runs. Persist each package state and
logs, reject cache tampering, and prove no-change reuse and single-delta rebuild.
Add generated-artifact Data/CSV behavior tests before retiring old authoring
projects. No immutable released package is changed by this work.

## 0. Status

In progress, first value-profile cohort Q0/Q1 PASS, public admission=false, no candidate allocated, no immutable `libs/*` bytes changed.

Branch: `work/WS-20261006-lib-refresh-v2` from `origin/main@0d4f1f5085f134d8c9a3214d8e235c6ab08beed2`.

## 1. North Star

`libspec/` is the only future Lib authoring authority. A Lib author keeps only `lib.json`, `lib.wit`, `delta.rs`, and thin `adapter.rs`. Historical `libsrc/` Cargo/wit-bindgen projects are migration input only and will be deleted after migration rather than retained as a compatibility surface.

Business `delta.rs` uses ordinary Rust and ecosystem crates. It must not know about wit-bindgen, Core ABI, Wasmi/Wasmtime, Store/Linker, producer-private APIs, or generated package layout. `adapter.rs` only maps WIT-facing types/errors to delta and delegates.

## 2. Implemented mechanism

- Added maintainer Skill `release-lib-refresh-v2` and routed future Lib authoring to it.
- Updated release-integrity boundary: only private compiler/provider bytes remain non-rebuildable; public future Libs are intentionally rebuilt from V2 source.
- Added `libspec/registry.json`, shared `rust-policy.json`, and one cohort `Cargo.lock`.
- Added `scripts/lib-refresh-v2.mjs`: exact explicit producer, strict four-file inventory, generated Cargo workspace, offline/locked build, content fingerprint, automatic dual Root validation, refresh receipt and qualification plan.
- Added `scripts/validate-lib-refresh-v2-source.mjs` and wired it into `validate-maintainer.sh`.
- Added `scripts/test-lib-refresh-v2.mjs` for Q1 over generated import-free Core artifacts.
- Migrated JSON, Compression and HTTP1 to the four-file value profile without changing their WIT contracts.

## 3. Q0 evidence

Fixed-lock refresh was executed independently twice. Both runs produced the exact same fingerprint and exact same package hashes.

- fingerprint: `b1e1260daa0936b6cbe73f98c0aab7e67e11080a312fc6bde97e803676a1fae2`
- producer SHA256: `73b1885a9a5e5427755ee4565e8c05b231e03f032ba784d5e73c67088ee838da`
- shared Cargo.lock SHA256: `73abce6d00084ead6327c4ca7ee3241785ab0754bac9c29e65ddf36ddd9249da`
- `--update-lock` bootstrap was also re-run after deleting the lock; it regenerated the same lock digest and moved the run into a directory matching the final lock-bound fingerprint.

Generated hashes:

- JSON artifact `90f64aba...590ae`, component `678fe804...f4ef3`, core ABI `373ccf4f...c92e`.
- Compression artifact `20f5d353...1cae7`, component `aaa7236e...ef3a`, core ABI `9af2f0ab...b62b`.
- HTTP1 artifact `e2872d16...dd138`, component `8b1fd8c0...a1d6e`, core ABI `8a5482a1...65985`.

All three generated manifests carry canonical `rust_core` plus `rust_component`, `core-abi.json`, `component.wasm`, and generated SDK sources.

## 4. Q1 evidence

`scripts/test-lib-refresh-v2.mjs` consumes only the refresh receipt/generated Root. It does not build historical `libsrc` projects.

- JSON: compact, invalid validate, pointer selection, 65KiB+1 input rejection.
- Compression: compress/decompress round-trip, invalid stream, 1MiB+1 input rejection.
- HTTP1: parse, frame length, response serialization, invalid status, 64KiB+1 input rejection.
- all three Core artifacts are import-free and generated `lib.wit` is byte-identical to V2 source WIT.

Q1 receipt SHA256: `f81c0bf06b801903cc5f21c4a262bf37d8555d386592de5afec89d5b012630c6`.

Wasmtime CLI is not installed on this hwlinux environment; Q2 remains the explicit multi-engine ecosystem gate rather than being hidden inside Q1.

## 5. Dependency decision

The historical Compression project pinned flate2 1.1.2 but the crate payload is no longer available in the offline Cargo cache; the historical project itself cannot rebuild `--offline --locked`. V2 therefore does not preserve that stale engineering shell. Shared policy uses cached/current flate2 1.1.10 with rust_backend and one cohort lock. Dependency version changes are cohort decisions, not per-Lib edits.

## 6. Validation

Focused current commands:

- `node scripts/validate-lib-refresh-v2-source.mjs`
- `node --check scripts/lib-refresh-v2.mjs`
- `node --check scripts/test-lib-refresh-v2.mjs`
- two independent fixed-lock `--all` refreshes
- `node scripts/test-lib-refresh-v2.mjs --run-root <Q0 run root>`
- `git diff --check`

The full maintainer validator still inherits a pre-existing fresh-main integrity mismatch for `AGENTS.md`; this existed before this workstream and is not repaired here because no candidate is allocated and immutable prior release identity must not be rewritten.

## 7. Next

Next implementation slice is the six Data Libs. The key architectural task is to extract a single shared Arrow/Data adapter so BatchSnapshot/WIT <-> Arrow conversion lives once, while each Lib delta contains only its algorithm. After Data: resource profile, then host/contract profile, then all18 Q2 and release Q3.

## 8. Do not do

- Do not add a second supported authoring format.
- Do not special-case package names in compiler/producer.
- Do not move business logic back into adapters.
- Do not restore per-Lib Cargo.lock or dependency versions.
- Do not rewrite existing admitted/released `libs/*` bytes in place.

### Baseline maintainer-integrity note

Full `validate-maintainer.sh` runs the new V2 source validator first and that
step passes. The next legacy release-integrity step fails on
`manifest identity mismatch: AGENTS.md`. This is proven pre-existing at the
workstream base `0d4f1f5085f134d8c9a3214d8e235c6ab08beed2`: base AGENTS.md is
17381 bytes / SHA256
`0be5c159ac964a3ab914e64cdd62d0c6d20ef4c2f6568b17c7b4ea57defbd56b`,
while base manifest.json expects 16487 bytes /
`7d5e0d871bc5d9b9f4f8587929cf9f84c08a13d3874644c1be9e9747ef8350f0`.
No release-integrity metadata is refreshed in this pre-candidate workstream.
