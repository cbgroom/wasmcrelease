# Current compiler distribution convergence

Task state: in-progress — exact classification authorized; publication/readback next

Objective: publish the latest qualified source-free compiler and keep only one
current compiler version in the repository HEAD served by jsDelivr. Historical
Git tags/Releases and unrelated Lib/SDK packages remain unchanged.

Base: public main 7e66609; private compiler master
e76c405f2e30af8bc113108af862637534773582. The retained qualified Wasm is
1,442,266 bytes, SHA256
032a408b7435333f65f3bc80ef2f5646edf829698bc384a276076bff8d64666a.

Plan: verify the transferred artifact; synchronize current facades; remove
superseded compiler binaries/embeddings; route Runtime to the canonical compiler;
bind a separate current-compiler authority without relabeling the frozen
v0.0.20 whole-product release or admitting pending Libs; independently verify
Node/Bun/Deno and integrity before main push and CDN readback.

Claims: current compiler distribution and its routing/integrity only. No compiler
source publication, Lib rebuild, Host API changes, tag rewrite or license change.

Validation: exact SHA256, import-free Core validation, 2 MiB cap, canonical output
and execution oracles on Node/Bun/Deno, singleton-version inventory, current
manifest integrity, clean synchronized Git and published/CDN artifact readback.
No Cargo build is planned; reuse the qualified bytes, no cache growth.

Results: Node/Bun/Deno each passes35 API outputs,25 CLI outputs,7 execution
oracles and7680 standard old/new/Rust consumer calls. Six actual tamper/carrier
controls reject and restore cleanly in a public source-free archive. Legacy
raw dist/package compiler files are deleted; forwarding JS and Runtime use one
compiler digest. Historical Lib/provider/plan and old App fixture are unchanged.
Whole-product v0.0.20 candidate rejects changed current product, as required;
its global identity files were not refreshed. No all18/Pi/full-release PASS.

Publication candidate4157786d9f042b472e743ed7b1709808ed1bc5f5 is local only.
Post-commit all-reachable scan covers5941blobs/173452027bytes,zero skipped/errors,
but rejects two unclassified AWS-format carrier findings. Each lies wholly in
the sole canonical compiler Base64 literal and decodes to the exact pinned
import-free Wasm; all nine detectors are clear on decoded bytes. No matched
credential-shaped values or their hashes were printed. Exact carrier objects:
3e17b25116f868ab49b17f90021bbe7c061217ac and
b1a46490f52a5f41b4187a72cd283666cc82f565. No scanner rule was changed and no
product commit/main/tag was pushed. Remote branch retains the start checkpoint.

User explicitly approved only the two exact carrier/digest classifications on
2026-10-04. Raw findings, exact-object matching, literal bounds, canonical decode,
Wasm validation/zero imports and all nine decoded-byte detectors remain strict.
Changed current carriers are independently rejected by Git object identity.

Resume: run security regressions and post-commit full scan; if accepted, push
the workstream and fast-forward main without changing any old tags/Releases.
Verify GitHub/jsDelivr full-commit downloads and record the completion receipt.
