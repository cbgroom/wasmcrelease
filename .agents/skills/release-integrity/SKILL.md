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

Hash equality proves byte identity, not behavior. A release needs both package
integrity checks and executable JavaScript/Rust behavior evidence. Report
browser, CDN, deployment, AOT, or compatibility scope only when actually run.

Use `./scripts/validate-maintainer.sh` for repository consistency, then run the
host journeys selected by `release-host-integration`.

After changing a tracked delivery file, run `./scripts/refresh-integrity.py`
after staging only the intended paths and before validation. The checksum
generator deliberately binds only Git-tracked files. Review the resulting
manifest and checksum diff; generated hash consistency does not authorize or
validate the underlying change.
