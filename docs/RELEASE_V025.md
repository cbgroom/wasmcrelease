# WAsmC 0.0.25: branch-local names

This patch fixes local binding visibility in `if` statement branches. Sibling
branches can declare the same name; the local remains unavailable after its
branch. Existing visible-name duplicate rejection and outer-name shadowing
restrictions remain. Physical local and resource cleanup slots stay distinct.

The portable compiler is 1,957,478 bytes, import-free, with SHA256
`23a91517a5217575d099a5c116a72db87f01e8cce22e4dc9af573ff6d456ac47`.
Its measured source is `7534e248c97db31bed84088830c04f4aad1c3cec`, canonically
integrated at `113f1a7ff2c53b20d3edd0272c9c611cadfc3d4b`. The versioned custody
receipts prove their compiler inputs equal; public delivery includes reviewed
Wasm and integration glue, without private compiler implementation source.

The new source-free regression exercises nested and sibling branches, records,
loops, name reuse after a branch, rejected out-of-scope access and managed
strings through the sidecar, single-file ESM and classic-script entrypoints.
The compiler-family qualification records the actual Node, Bun and Deno runs.
Private source qualification additionally covers injected failures, exact owner
cleanup and recovery in the same Store.

CoreLib 4.9.1, Std 1.4.1, JSON 0.0.6 and the complete current 42-Root catalog
retain their existing artifact bytes and original producer lineage. This patch
does not resolve the separately investigated unused Host imports or long-response
fuel consumption; limits and explicit Host authority remain unchanged.

Candidate qualification, matching Native packages, stage promotion, the selected
GLM 5.3 Flash single-model review and immutable publication/download evidence
remain separate receipts. `release.json` and channel records determine which
exact immutable product is formally released. Previous tags remain unchanged.
