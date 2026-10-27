# Rust glue compilation and Lib loading: capacity inventory

Scope: source inspection of MCPGit `6e5d4b075834e3f83dbd8e9fac3322aa153591e5`
and WAsmC candidate `47491ca8a34006a01af9586c34478e1aacb72e2a`. The running
local Rust translator image labels Source `59155b6ee2808463fd803a4440f1a4e1df1bc3fe`.
Only the 256 KiB HTTP request failure below was executed against that service;
other rows are source-level boundaries, not proof of current deployment.

| Layer | Observed default or fixed bound | Effect |
| --- | --- | --- |
| Translator HTTP + compiler request | 256 KiB | Rejects large source; exact 484015-byte relational SDK returned 413. |
| MCPGit HTTP compiler client | 256 KiB source, 4 MiB artifact, 64 KiB diagnostics, 12 s timeout | Separate client checks/response reads; widening the server alone does not widen this path. |
| Rust compiler service | 4 MiB result, 64 KiB diagnostics, 10 s compile deadline | Output and deadline can reject otherwise valid builds; diagnostics are bounded. |
| Persistent build Object | 8 MiB per Object, 64 KiB read chunk | The Object ceiling rejects; the chunk size controls transfer granularity and is not by itself a total-size limit. |
| Core Lib object loading | manifest 256 KiB, WIT 2 MiB, artifact 16 MiB, ABI 2 MiB | Each is also limited by the 8 MiB buffered Table Object ceiling; effective Core artifact read bound is 8 MiB on this path. |
| Canonical Rust SDK producer | official declaration source 2 MiB, complete generated source 4 MiB, final Root SDK source 2 MiB | Independent producer-stage guards; the smallest applicable bound governs. |
| Canonical SDK Root reopen | SDK source 2 MiB, WIT 1 MiB, artifact 16 MiB, manifest 256 KiB | Independent reader constraints can reject a package after another layer accepts it. |
| Compiler concurrency | 2 default process-wide compiles, 64 same-key waiters | These are scheduling/admission behavior, not the Lib's element or byte capacity. Overload can return 503. |
| In-memory compiler cache | 128 entries or 16 MiB | Affects caching/eviction, not whether an otherwise acceptable artifact can compile. |

The priority repair is an end-to-end optional resource policy shared by HTTP,
client, compiler, package reader and loading paths; an unset per-item ceiling
should not add an arbitrary Lib size cap. Explicit configured ceilings and
actual system memory remain separate. Deadline and concurrency policy need
separate behavior and recovery tests, rather than being mistaken for a maximum
input size. Keep exact length/digest, version, ownership and transfer checks.
Do not change historical released artifacts or infer that changing one layer
proves complete acceptance. Prove each affected path with relational SDK >256
KiB, >2 MiB generated SDK, >4 MiB output and >8 MiB package Object where the
scenario is applicable, plus normal error/recovery and independently read back
identity. Coordinate ownership before source edits and rerun exact deployed
candidate rather than using stale labels.
