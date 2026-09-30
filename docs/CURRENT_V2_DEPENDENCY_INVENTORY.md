# Current-v2 dependency materials (unreleased)

Run `node scripts/test-current-v2-dependency-inventory.mjs` to verify the
conservative registry closure of the exact HTTP1, Data Core, HostClock,
ResourceCounter, OwnedAlgorithms and generated-SDK consumer lockfiles.
This includes all lockfile packages, not just dependencies
reachable on the maintainer's platform. Target reachability is not inferred.

The retained receipt binds 189 crate versions and archive checksums to those
six lockfiles. All archives were checked against Cargo's locked checksum.
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

The three canonical adapter inputs now live in `dependency-inputs/` as Cargo
lock metadata only. HostClock and ResourceCounter match both retained build
passes byte-for-byte. OwnedAlgorithms' generated temporary lock was not
retained: its exact two-local-package content is reconstructed and must match
the full build-input SHA256 in the delivered manifest. It has zero registry
dependencies. A merely equivalent lockfile is rejected. No private path,
compiler dependency or adapter implementation is published.

The receipt also binds `toolchain-notices/receipt.json`, covering the exact
five package builder fingerprints. Run
`node scripts/test-current-v2-toolchain-notices.mjs` for its independent
verification. The complete official Rust 1.96.0 macOS-arm64 rustc archive was
checksum-verified; its compiler/library copyright HTML is byte-identical to
the installed builder. Both documents are carried as gzip files with pinned
compressed and uncompressed identities (444,754 compressed bytes total).
No Rust compiler executable or implementation is copied. These are copyright
documents, not a claim that the build tools themselves are distributed.

Do not obtain these files from the rust-docs archive: the installed component
manifest assigns both to rustc. The first docs-only probe failed and was not
accepted. Producer version-output fingerprints hash trimmed UTF-8 output;
including its terminal newline would describe a different fingerprint.

Remaining requirements:

- Review license choices, obligations and target-specific applicability.
- Admit the reviewed obligations with the exact future candidate and all
  remaining package cohorts.

Until these close, `full_transitive_license_audit=false` and
`release_qualified=false`. The strict five generated roots remain unchanged.
The staged 76-file licensed envelope now carries this inventory, all six input
locks and both official toolchain documents. Isolated 78-file generated-SDK
execution and deletion/tamper controls qualify that scoped material delivery;
they do not close obligation review or all-package release admission.

## Explicit registry notice choices

`registry-notice-review.json` records a finite technical choice/evidence plan
for all 189 registry identities and 17 declared expressions in the retained
closure. Validate it with:

```sh
node scripts/test-current-v2-registry-notice-review.mjs
```

An explicit OR selects MIT where it is declared, including the r-efi
alternative; this does not select LGPL or rewrite its original AUTHORS file.
AND retains every required term: Arrow Array retains Apache plus MIT;
encoding_rs retains MIT plus BSD-3-Clause; unicode-ident retains MIT plus
Unicode-3.0. Historical slash expressions conservatively retain both licenses,
without inventing an OR meaning. Apache-with-LLVM retains the exact exception
text, but this plan relies on no exception-based omission of notice conditions.
All original and supplemental notices remain in the existing delivered
inventory, even when an OR choice needs fewer materials.

The choices follow the declared expressions and retained source notices;
reference texts are the [SPDX license list](https://spdx.org/licenses/).
The finite evidence checks are not a general license-text matcher, a legal
opinion or a statement that every non-notice obligation is met. Unknown
expressions fail closed. Deletion of an AND-term notice, a self-rehashed
truncated Apache text, removal of the LLVM supplement, and false promotion
claims are independent rejection controls.

This new review receipt itself is not yet in the 76-file envelope. Pending:
bind it into the future delivery; verify actual build-source modifications and
patches; review target/toolchain obligations; audit the other thirteen target
packages. `full_transitive_license_audit` and `release_qualified` remain false.
