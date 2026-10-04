# Current compiler distribution convergence

Task state: in-progress — implementation qualified; publication/readback next

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

Resume: finalize current manifest and source-free qualification receipt; commit,
scan all reachable raw Git blobs including the new commit, push and fast-forward
main, then verify full-commit jsDelivr and GitHub downloads against the pinned
SHA256. Preserve source-free and CDN readback evidence privately.
