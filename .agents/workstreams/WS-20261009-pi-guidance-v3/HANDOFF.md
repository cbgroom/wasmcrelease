# Pi-guided release guidance V3

Current work: critical execution integrity and exact 64-bit call fixes.
Previous 60-case qualification applies only to 50ef26415a9f972bd9fa84ccac15fabf81c3a640,
not the changed working tree. Its immutable receipts remain under
agent-evaluation/receipts/pi-guidance-v3-refinement-20261009.

Actual temporary-copy reproductions showed that a hash-checked eight-byte empty
Wasm was reported as the compiler while the default embedded compiler executed;
an altered facade executed before the integrity check; and JSON number arguments
could not execute a supported u64 program. Compiler, facade, Provider and Roots
remain byte-unchanged. Fixes target only the new execution helper, its guide and
actual regression controls. No oracle/budget/protocol changes are authorized.

Complete focused preflight, freeze the next guidance commit, and run all three
fresh Pi rounds plus independent review and source replay. Preserve old prod/tag
and all nine release identity files; old candidate drift rejection is required.
This remains an unreleased guidance workstream, not successor release admission.
