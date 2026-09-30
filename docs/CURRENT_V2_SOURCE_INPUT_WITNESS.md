# Build input witness — unreleased

The current portable build runner records exact workspace file paths, lengths
and SHA256 before producer execution, verifies the same files after execution,
and requires both independent builds to have equal witnesses. WIT/build
configuration and declared sibling WIT/LICENSE files are included. Cargo
output is excluded only under a directory with Cargo.toml: src/target remains
an input. Linked inputs/workspace parents, changed or missing files and added
build scripts reject. No input source content is copied into public receipts.

Run the independent fixture controls:

```sh
node scripts/test-current-v2-build-input-snapshot.mjs
```

`build-current-v2-portable.mjs` must run from a clean checkout of a committed
public input revision against the selected clean private producer and a new private
output directory. It captures before/after witnesses around the real build.
`stage-current-v2-next.mjs` requires those witnesses and rechecks retained
inputs before copying any delivery bytes. Do not insert generated source
digests into an old receipt and call that historical build proof.

The original five staged builds predate this guard. Their artifact behavior
and package-byte checks remain scoped evidence, not source-witness PASS.
Rebuild them with the guarded runner and compare exact complete roots before
claiming this new gate. A witness does not prove registry cache integrity,
toolchain source integrity, deleted temporary generated-adapter contents or
license compliance. Source/configuration paths remain relative, and private
compiler implementation stays private. All 18 package and release gates remain.

## Actual HTTP1 guarded rebuild

`admission/current-v2-next/http1-build-input-witness.json` retains the two real
producer receipts from clean public input 22341148a11d4154b156e3d2bf98d77c7cf4bbbc
and clean producer 3b797a77d0afa25264a11362603b0d596d2e0ba7. Both builds captured
nine retained input files before execution and verified them afterward. The
two witnesses match, and a separate post-build check reopened both workspaces.
All nine package files match both each other and the existing staged HTTP1
0.0.1 root byte-for-byte. No package or immutable release bytes were replaced.

This initial record closes the new retained-input stability gate for HTTP1 only.
The subsequent full staged-cohort record below supersedes its pending cohort
status. The receipt is an audit record outside
the strict root, not a delivered-license-envelope update or release admission.
Registry cache, external temporary adapters and full license obligations remain
unattested. The original historical receipts are not retroactively certified.

## Five-package guarded rebuild

The whole staged cohort was rebuilt from clean public input
cf26b71c5b9d0d9b121bedfb6499016d42783d18 and the same clean private producer.
`admission/current-v2-next/cohort-build-input-witness.json` records both actual
builds of HTTP1, Data Core, Host Clock, Owned Algorithms and Resource Counter.
All 38 retained input files passed pre/post stability and independent witness
equality; a separate post-build check reopened both workspaces per package.
All 45 generated delivery files match the existing staged complete package
roots. No binary, strict root, catalog or immutable release bytes changed.

Run `node scripts/current-v2-retained-build-witness.mjs` for source-free receipt
and complete-root verification; `node scripts/test-current-v2-retained-build-witness.mjs`
exercises 27 rejection controls, including independently pinned observed source
witnesses, coordinated self-rehash, actual file faults and linked roots/entries.
This public check never claims to reexecute the private input check. These audit
records are not yet carried by the licensed recipient envelope. The eight
unrebuilt targets and all-package release/ordinary-App gates remain unchanged.

A separate live read-only check found all 12,335 extracted source files in the
189-crate conservative dependency inventory equal to checksum-verified cached
archives, with no unexpected files except the exact Cargo `.cargo-ok` marker.
This is diagnostic evidence at the observation time, not a captured pre/post
build cache witness, historical certification or a reproducible CI audit gate.
Registry-cache build stability, external temporary adapter contents and full
target/toolchain license obligations remain pending.
