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

Use `./scripts/validate-maintainer.sh` for repository consistency, then run the
host journeys selected by `release-host-integration`.

After changing a tracked delivery file, run `node ./scripts/refresh-integrity.mjs`
after staging only the intended paths and before validation. The checksum
generator walks candidate files excluding .git, target, .DS_Store and temporary
outputs; verify every included file is intended and staged before admission.
Review the resulting
manifest and checksum diff; generated hash consistency does not authorize or
validate the underlying change.
