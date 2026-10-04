# Current compiler distribution convergence

Task state: started

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

Resume: verify candidate and inspect current facade compatibility before edits.
