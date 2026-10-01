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

## Registry source guard

`current-v2-registry-source-witness.mjs` now verifies all conservative locked
crate archives against their locked SHA256 and compares every extracted file
against the verified archive. Missing, changed, added or linked source files,
extra directories, unsupported archive entry types and unsafe paths reject.
Only the exact generated Cargo `.cargo-ok` marker is excluded from source-tree
identity; no implementation content is emitted. The reviewed archive subset is
regular files and GNU longname headers, not a general tar extraction library.

Independent fixture: `node scripts/test-current-v2-registry-source-witness.mjs`.
34 rejection controls include cache/archive faults and source/registry/patch,
path and environment overrides. The actual current cache contains 189 matching
crates / 12,335 matching files; this snapshot alone remains nonhistorical.

The portable build runner accepts an explicit fourth `CARGO_HOME` argument
after PACKAGE_ID. It passes that exact home to the private producer, records
the registry witness and inherited Cargo config digests before execution, and
compares them after each build and across independent builds. Configs that
redirect source/registry/path/patch resolution or registry environment overrides
reject. Only the observed crates.io directory layout is supported by this audit;
different layouts need explicit reviewed support rather than a silent fallback.
Cargo configs must match the exact reviewed non-routing config digest, not a
partial TOML interpretation; quoted/dotted routing keys also reject. Additional
configuration profiles require review. A config-free path is supported.
Omitting that fourth argument does not attest to registry sources. Temporary
generated adapter contents, wrappers/toolchain execution and full license
obligations remain separate unclosed gates. No old build is retroactively PASS.

Actual HTTP1 dual-build receipt at public input e64d2ce is retained in
`admission/current-v2-next/http1-registry-build-witness.json`: both real builds
passed the selected 189-crate cache/routing guard, both workspaces/current cache
were separately rechecked afterward, and all nine output files equal the staged
package. This is not yet carried-envelope validation, and four other staged
roots still need the registry-guarded build. The original ENOBUFS failure before
build execution is retained in the workstream handoff; a 2 MiB committed-input
fixture now prevents recurrence of the default Git output-buffer truncation.

The routing guard also scans retained nested crate directories for Cargo configs,
because the producer can invoke Cargo from a nested crate. Its current fixture
has 36 rejection controls. Crate-local target output remains excluded, but a
source directory named src/target is still inspected. Earlier real receipts
retain their original guard revision; their workspace witnesses can prove that
no nested config was present, but do not claim the newer nested-scan code ran.

## Completed staged-cohort registry build

The four-pending registry-build status above is superseded by the real full
cohort run from 1e3d3e4ab96704184c9498cc1cb189afa5ace122. All five staged packages
pass the selected registry/routing checks before/after each independent build.
The ten retained workspaces/current cache were separately rechecked afterward;
all 45 complete delivery files equal the prior staged roots. The outer receipt
is `admission/current-v2-next/cohort-registry-build-witness.json`. Its shared
189-crate source-tree metadata is stored once, not repeated per build.

Run `node scripts/current-v2-retained-build-witness.mjs --registry` to validate
the recorded identities and actual delivery files without reexecuting private
cache/build checks. The retained-build fixture now includes 27 workspace and
21 registry rejection controls. Exact observed input identities are independent
of the receipt, so coordinated self-rehash cannot authorize replacement sources
or routing. No temporary-adapter contents, complete license obligations,
recipient-envelope delivery, ordinary App or all-package release is attested.

The subsequent licensed-delivery gate now carries both canonical full-cohort
records in its outer 79-file capsule. Fresh-recipient verification and 69 fault
controls cover record deletion, tampering, links and coordinated witness/index
self-rehash; public generated-SDK consumption passes from an isolated 81-file
tree. See CURRENT_V2_LICENSED_DELIVERY.md. This supersedes the pending delivery
status above, not temporary-adapter, toolchain/target obligations, ordinary App
or release status. No old strict roots were edited to carry audit metadata.

## Generated-adapter capture primitive (not a real-build receipt)

`node scripts/test-current-v2-generated-adapter-snapshot.mjs` exercises a
metadata-only snapshot of one explicitly selected generated adapter child.
It retains byte counts and digests for the complete input tree, requires
Cargo.toml/Cargo.lock/mapping.json/src/lib.rs and rejects missing, changed,
linked, oversized or out-of-scope inputs. Only root Cargo target output is
excluded; src/target remains an input. The fixture has 22 negative controls
and is included in development candidate CI, not immutable-tag release CI.

At the current producer, the generated adapter is a temporary child of its
workspace, deleted after publication, not a global TMPDIR crate. Its source
digest covers src/lib.rs only. The mapping and lock have separate producer
digests; none independently qualifies the generated Cargo.toml. The primitive
can bind those three observed digests but explicitly keeps manifest
qualification, real-build observation, full license audit and release false.

Next connect this capture to this invocation's fixed Cargo child before and
after execution, including offline lock generation. Retain a source-free
receipt before adapter removal; compare independently built input identities
with an explicit rule for absolute dependency paths in Cargo.toml rather than
assuming byte equality. Do not watch shared global temporary directories,
patch private compiler source or retrospectively relabel old build receipts.

Apply that generated-child gate by the actual build profile, not by the CLI's
field name. The mapped-adapter OwnedAlgorithms path creates that child; the
direct wit-bindgen-component path (HTTP1, DataCore, HostClock, ResourceCounter)
builds retained source and emits its source hash under the same CLI field.
Absence of a temporary child on a direct profile is not missing evidence.

The portable runner optionally accepts an explicit fifth OBSERVED_REAL_CARGO
path after the audited Cargo home. It installs a delegate only in each private
pass directory and prepends it only to that producer child's PATH. Known version,
offline lock-generation and fixed locked/offline build invocations delegate to
the exact Cargo binary unchanged. Unknown invocations and out-of-workspace builds
reject. Generated inputs are captured before/after Cargo and bound to the
producer's source, mapping and delivered-lock identities. The observer preserves
nonzero Cargo exits and labels this interposed profile explicitly. No globally
installed wrapper or shared-directory watcher is used.

`node scripts/test-current-v2-cargo-adapter-observer.mjs` exercises delegation,
lock creation, successful build observation, mutation rejection and failure
retention using a fixture delegate, with ten rejection controls. This is not a
real producer build. Manifest qualification, independent generated-manifest
comparison, wrapper/toolchain execution and full obligations remain separate.

## Actual OwnedAlgorithms mapped-adapter observation

The real r13 dual build used public input
`c0ac1e389b7f38d9a875fcb1cdda7ecf0200c150` and the exact clean private producer
`3b797a77d0afa25264a11362603b0d596d2e0ba7`. Both lock-generation and build
subprocesses completed successfully. The generated four-input tree was stable
through each locked build; source, mapping and lock digests bind to producer
and delivered manifest evidence and equal across passes. All nine delivered
files are byte-identical between passes and to the existing staged package.
Both retained workspaces and the selected registry/routing were independently
rechecked after completion. No private source bodies were projected.

`admission/current-v2-next/owned-generated-adapter-observation.json` records this
explicit interposed profile, not retroactive evidence for r12 or another Lib.
The complete private receipt remains under the exact r13 private output path;
`scripts/capture-current-v2-owned-adapter-observation.mjs` rechecks the retained
inputs/cache/outputs before projecting that particular observation. The two
generated Cargo.toml digests differ. Absolute dependency paths are expected in
the producer's manifest template, but the snapshot alone does not prove that
paths are the only difference. Manifest qualification and independent normalized
comparison remain false, as do licensed-recipient delivery, full audit and release.

## Complete generated manifest profile gate

The observer can now check the complete finite generated Cargo profile against
the independently selected build specification before delegation and afterward.
Only package identity/version/edition, cdylib, one expected local dependency,
abort profile and isolated workspace are accepted. Unknown/duplicate fields,
sections, dependencies, build scripts or escaped/unsupported syntax reject;
this is explicitly not a general TOML parser. Dependency path must equal the
selected real workspace crate, not merely any path below that workspace.

It computes both semantic identity and a byte-preserving path-scrubbed digest:
exactly one validated dependency path literal is replaced with its stable
workspace-relative identity. Every other byte, including formatting, remains
covered. Independent builds must match both semantic model and path-scrubbed
bytes. The old r13 observation remains unqualified by this newer gate.
`node scripts/test-current-v2-generated-manifest-profile.mjs` has 24 fault
controls; the scoped Cargo observer fixture now has 12 and rejects invalid
manifest profiles before delegation. Real execution of the new gate remains
separate from these fixtures and must retain a new source-bound receipt.
