---
name: release-integrity
description: Maintain WAsmC public release artifacts, manifests, checksums, version selection, provenance, and publication without exposing private source or weakening immutable identity.
---

# Release integrity

## Mental model

This repository is a source-free delivery boundary. A release is one atomic
set of compiler bytes, facade, matching Libs, metadata, examples, manifest,
provenance, and checksums admitted by the private source authority. A branch or
CDN alias is discovery state; an immutable tag or full commit is package identity.

## Rules

- Inspect the exact public tag and mutable branch independently.
- Never rebuild compiler or Lib bytes here.
- Compiler modification approval never implies source-publication approval.
  Open Wasmi/Wasmtime glue, Host adapters, CLI and tests may be built here against
  admitted Wasm artifacts; private compiler source, implementation-bearing source
  maps, build archives and private-source caches must not enter public delivery.
- Accept new binary packages only with the private clean synchronized source
  commit, toolchain/profile, behavior evidence, and matching public files.
- Git checkout must preserve exact delivery bytes on every platform. Disable
  automatic newline/text filters with the repository attributes contract;
  generated WIT/SDK/metadata are hash-bound products, not editable formatting.
  Windows CRLF transformation is an integrity failure, not engine incompatibility.
  Reproduce it with controlled checkout and retain rejection tests; never relax
  the digest check or rewrite admitted payloads to conceal the failure.
- Keep version, Lib contracts, JavaScript exports, examples, manifest,
  provenance, package index, and release notes consistent.
- Exclude reproducible local build outputs such as Cargo `target/` directories
  before regenerating repository checksums; package integrity must not absorb a
  maintainer machine's cache.
- Existing tags are append-only. Move only the mutable discovery pointer when a
  new immutable version has passed admission.
- Documentation on mutable `main` may describe work in progress only when it is
  labeled as such; released capability must be checked against the immutable tag.

## Validation judgment

For a new version's dev/main/prod publication or promotion, first read
[release channel contract](../../../docs/RELEASE_CHANNELS.md). A suffix-free prod
is a promotion of one qualified product digest set, not a rebuild or a stable1.x
claim. Prerelease stages never advance the default prod discovery pointer.

Raw credential hits must remain visible even after explicitly authorized false-positive classification. The 2026-09-13 approval admits only the two exact historical compiler-carrier Git blob identities in `scripts/scan-reachable-credentials.mjs`: AWS-format matches must lie wholly inside the canonical Base64 literal, decode to the fixed reviewed compiler digest, validate as import-free Core Wasm, and pass all nine detectors on decoded raw bytes. Unknown blobs/digests, extra or outside matches and any decoded finding reject. No path-wide ignore, history rewrite, skip or general detector exception is permitted. Keep `--raw-only` rejecting evidence and a committed-then-deleted credential negative test. Admission requires zero unresolved findings, zero skipped blobs and zero scan errors, not a false claim that raw findings never existed.

Hash equality proves byte identity, not behavior. A release needs both package
integrity checks and executable JavaScript/Rust behavior evidence. Report
browser, CDN, deployment, AOT, or compatibility scope only when actually run.

Candidate reopen must pin the manifest itself and product files to independent
expected identities from the selected trusted checkout/producer receipt. A
package cannot authorize replacement bytes by rewriting its own manifest.
Exercise actual verification failures on mutated package copies, including
self-rehashed replacement, path/inventory drift and linked files/directories;
a test that merely compares two hashes is not a reopen rejection test.
Canonical resource-new/drop intrinsics are not OS Host authorities, but must
still match an explicit exact import set. Source-free consumers may copy public
SDK/driver glue and WIT, never Lib implementation or machine build caches.

When a generated package schema has a strict inventory with no license field,
do not edit its manifest or insert unbound license files into its root. Bind
that exact manifest and every delivery file in an outer license distribution
manifest. The future candidate must carry the envelope, research license,
policy and reviewed third-party notices together. Validate a fresh isolated
delivery against independently pinned build receipts; reject dropped notices,
self-rehashed replacements, linked entries and false upstream relicense claims.
An exact license binding is not a full dependency/toolchain license audit;
record those missing obligations separately and keep release admission false.

Audit actual build inputs, including generated adapter locks and generated-SDK
engine dependencies, not just primary crates. A deleted temporary lock may be
recovered only by equality with the delivered manifest's full input digest.
Bind toolchain copyright materials to the exact builder fingerprint and a
checksum-verified official distribution archive; consult installed component
ownership rather than guessing the docs package. Trim verbose version output
exactly as the producer fingerprint does. Retaining complete materials closes
inventory only: obligation review and isolated distribution delivery remain
separate gates, and upstream licenses are never rewritten by repository terms.

The outer delivery must carry the audit inputs and complete notice materials,
not merely refer to a successful check elsewhere in the repository. Validate
deletion, mutation and self-rehashed replacement of dependency inventories,
locks and toolchain documents in a fresh recipient tree. If a consumer lockfile
is already carried, verify byte equality and reuse it; never overwrite it to
make an SDK run pass. An expanded capsule still leaves obligation review and
all-package release false until their independent gates close.

Record finite, explicit license-expression choices separately from material
inventory. Preserve every AND term and the original notices even when an OR
branch is selected; never infer OR from an old slash expression. An exact
notice evidence plan is not a license-text equivalence engine, modification
audit, target applicability review, or legal approval. Require rejection of
missing conjunctive notices and self-rehashed truncation, and bind the review
itself into delivery before claiming that recipients receive it.

Use `./scripts/validate-maintainer.sh` for repository consistency, then run the
host journeys selected by `release-host-integration`.

After changing a tracked delivery file, run `node ./scripts/refresh-integrity.mjs`
after staging only the intended paths and before validation. The checksum
generator walks candidate files excluding .git, target, .DS_Store and temporary
outputs; verify every included file is intended and staged before admission.
Review the resulting
manifest and checksum diff; generated hash consistency does not authorize or
validate the underlying change.

### Pre-candidate workstream exception

Do not apply that refresh rule mechanically to an early workstream branched
from an already immutable prod release when the workstream intentionally changes
files frozen by that prod candidate and no new release/product candidate identity
has been allocated yet. Refreshing in that state rewrites the old version's
`release.json`, `manifest.json`, and provenance inventory around future bytes,
which can be internally hash-consistent while being semantically false.

In this pre-candidate state:

1. keep the immutable tag, prod pointer, old candidate manifest, and old release
   identity files byte-unchanged;
2. require focused workstream tests and explicitly prove that the old candidate
   rejects the changed tree as product drift;
3. label the branch as unreleased/future-version work;
4. once the new product set and version are intentionally frozen, create the
   new candidate identity, then refresh/stage global integrity metadata and run
   the full release validators.

An integrity script returning PASS after relabeling future bytes as an old
release is not sufficient semantic evidence; version identity is part of the
contract.

### Current development CI

Choose the validation surface by immutable tag versus development checkout,
not by the name `main`. Current-v2 development runs
`scripts/validate-current-development.mjs`: verify every selected package
against its catalog, exercise API discovery and its excluded-package controls,
preserve release identity metadata against the pre-migration checkpoint, and
require the old candidate's specific product-drift rejection. Release-tag CI
continues strict release checks. Expected drift is never a release PASS; avoid
creating a throwaway candidate or treating any verification failure as success.

Current-development validators read the pinned frozen release baseline from Git.
Any workflow invoking them (directly or through nested surface validation) must
provide that exact history, not only a depth-one checkout. Reproduce the shallow
failure and the full-history success with `test-current-v2-history-baseline.mjs`;
never substitute live metadata when the trusted baseline is unavailable.
Always retain failed validation suite diagnostics as CI artifacts. A failure
count without its underlying stderr is insufficient for white-box remediation.
