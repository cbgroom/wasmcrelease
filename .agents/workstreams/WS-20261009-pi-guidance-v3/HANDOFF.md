# Pi-guided release guidance V3 refinement

The user requested continued improvement after draft PR #24. Prior 60-case
qualification remains bound only to 52facc4d06ff9dc530ad7a41bb9ae6e5ccf2a024 and
agent-evaluation/receipts/pi-guidance-v3-20261009. Do not present it as evidence
for the modified successor.

Refinement: use the exact interface keyword for Library discovery, run its
combined verification once, and route digest rejection to a shipped pure
fixture with a tested export/calls. Distinguish verifier child exit 1 from
expected-rejection wrapper exit 0. A dedicated CI fence checks the immutable
old product, focused tests and actual old candidate drift rejection. Broad
whole-product failures remain visible; no old metadata refresh is authorized.

Next: focused preflight, freeze a clean successor commit, rerun the unchanged
10-case protocol on both routes for three fresh rounds, independent review and
source replay, then update the existing draft PR with separate evidence. Future
whole-product inventory, admission and publication remain separate.
