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

This closes the new retained-input stability gate for HTTP1 only. Four other
staged roots still need guarded rebuilds. The receipt is an audit record outside
the strict root, not a delivered-license-envelope update or release admission.
Registry cache, external temporary adapters and full license obligations remain
unattested. The original historical receipts are not retroactively certified.
