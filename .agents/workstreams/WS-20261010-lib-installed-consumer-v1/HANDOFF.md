# Installed Std Root — source-free production consumer

Branch: work/WS-20261010-lib-installed-consumer-v1.
Base: wasmcrelease main@c888af39c11640644591ff42aeaf8b09f632f651.
Task: task-wasmc-std-lib-production-coverage.

## Current evidence and actual gap
Native Node24 on E5 uses NODE_USE_ENV_PROXY with preexisting Xray HTTP1081.
The exact jsDelivr immutable artifact commit
57f03cf6c0f2a98b37ea9c2294046ccd6644c1ba returned all 19
wasmc-std@1.4.1 files with status200 and exact file SHA/size. A real
installCurrentLib call (only diagnostic fetch wrapper for request logging)
published an atomic directory symlink with verified19 complete files.

The installed directory is a complete package file tree:
<target>/current-libs/wasmc-std/1.4.1/artifact.wasm
and companion source, WIT, LICENSE, plans and SDKs. The separate current
examples/current/standard.mjs --installed expects a product-shaped
<base>/standard/wasmc-std/1.4.1/artifact.wasm. Treat that as distinct
layout; do not fake flat installed Roots or alter v0.0.21 bytes.

## Implementation scope
Provide a new, explicit source-free installed-target consumer test using
the existing Catalog and complete Root lock verifier before opening any
Wasm; load Std artifact + exact plan only from the installed target and
the separately SHA-pinned Provider4.9 from the product. Compile the exact
current WAsmC sample with current compiler; run paired compiled/sealed/
Rust sample oracles with full lifecycle and 7680 calls. Include explicit
wrong path/digest/import/engine negative gates. This is not a new Lib
publication, Host grant, digital-signature claim or commercial license.

## Dependency
Composite map<string,Record> replace needs ownership-preserving CoreLib
API successor; existing object_set_child_move recursively destroys old
child and cannot implement Map.insert Option<OldRecord>. Keep this
separate private compiler/CoreLib workstream blocked until versioned
exchange/drop/borrow failure semantics have independent test evidence.

## Next
Use exact current App source and plans, focused scripts/test-lib-install.mjs,
scripts/test-current-lib-api-v021.mjs, run Node source-free test.
Record exact SHA, input roots and failing negatives, commit/push this
work/* branch, then register receipt in YXSGIT. No main edits.


## 2026-10-10 qualification — complete installed Root consumer

**Implementation slice complete, integration not yet merged.** Added
scripts/test-current-installed-std-v1.mjs. It reads the installed Root
files exclusively from <installed-target>/current-libs/wasmc-std/1.4.1,
reopens exact public catalog and every package inventory byte, compares
install-receipt.lock_sha256/catalog/commit/profile/files and requires the
installer's symlink publication. It does not read the in-tree Std library
as a fallback. It supplies separately pinned Product CoreLib4.9 by the
exact c3ac... identity, compiles current WAsmC app through the public
compiler, verifies sealed WAsmC and Rust sample artifacts, then executes
all three with real Node WebAssembly Provider+Std+App: 7680 calls PASS.

Negative in-process checks: altered installed artifact, wrong WIT, missing
installed file, drifted lock receipt, fabricated Host grant (5 rejects).
Standalone CLI rejects incorrect flat path and wrong CoreLib location.
Original installer simulated HTTP fault suite passes 19 exact files and
10 negative cases; other existing product tests pass. Public release.json,
catalog/libs-current-v2.json and current/wasmc_compiler.wasm digests are
unchanged. See qualification.json for all exact digests, command, case
counts and boundary statements.

Prior unmodified CLI live installs had two transport_failed outcomes;
the logging-only real fetch wrapper completed one live immutable CDN
installation of19 correct bytes. No automatic retries, redirect handling,
trust boundary or product bytes have been relaxed. The next product-facing
work should resolve caller UX (installed package tree versus product
standard/ path) and validate repeatable live mirror behavior separately.

No new Std API, no CoreLib/provider ABI change, no composite Map owned
value semantics, and no legal/device/Host production claims. Keep this
branch separate from published v0.0.21 until independent review.
