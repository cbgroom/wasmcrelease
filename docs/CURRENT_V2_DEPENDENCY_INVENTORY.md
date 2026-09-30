# Current-v2 dependency materials (unreleased)

Run `node scripts/test-current-v2-dependency-inventory.mjs` to verify the
conservative registry closure of the exact HTTP1, Data Core and generated-SDK
consumer lockfiles. This includes all lockfile packages, not just dependencies
reachable on the maintainer's platform. Target reachability is not inferred.

The retained receipt binds 175 crate versions and archive checksums to those
three lockfiles. All archives were checked against Cargo's locked checksum.
License declarations and packaged notice texts were read from those archives,
not from a registry search result. No upstream implementation source is copied.

Fourteen Wasmtime/Cranelift archives lack packaged notice files. Their exact
archive VCS metadata identifies the upstream commit; the archive's original
Cargo.toml was compared byte-for-byte with that commit before obtaining its
root LICENSE, including the LLVM exception. Never replace this with a generic
Apache license or fetch from main/latest. r-efi carries its MIT grant and
copyright notices in AUTHORS; a LICENSE-only filename heuristic missed it.
The original missing-file observations remain derivable from each row's
`blockers`; supplemental materials do not pretend those files were in the
original archive.

`dependency-inventory.json` embeds exact notice texts and their hashes. It is
an audit input, not a legal opinion, license choice, distribution approval or
complete dependency audit. Public validation checks the retained input and
notice identities without network access. Re-capture requires the checksum-
verified local Cargo archives and pinned upstream public metadata; it does not
rebuild any compiler or Lib.

Remaining requirements:

- Recover and audit all three canonical adapter build lockfiles, independently
  bound to their delivered manifests.
- Bind Rust standard-library/toolchain notices to the exact build toolchain.
- Review license choices, obligations and target-specific applicability.
- Carry all applicable materials in the future licensed delivery and test its
  isolated reopen, including deletion/tamper controls.

Until these close, `full_transitive_license_audit=false` and
`release_qualified=false`. The current five-root license envelope is unchanged;
this inventory must not be described as already included in that envelope.
