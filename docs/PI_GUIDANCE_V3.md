# Pi-guided Agent guidance V3

This is an unreleased future-product workstream over the unchanged v0.0.21
compiler, Provider, complete Library Roots and SDKs. It does not promote or
replace the immutable v0.0.21 package. The old product candidate intentionally
rejects this changed guidance tree. Its release, manifest, provenance, checksum,
channel and tag identities must remain unchanged until a future product freeze.

Consumers start at AGENTS.md, select an intent in the small agent-quickstart.json
index, then run its read_command to verify and read only the selected route.
The machine-readable integrity file retains complete route pins without requiring
manual hashing or repeating unrelated digests in an answer. Read only the selected
route's additional authority and execute its named checks. General source and
Library routes cover requests that differ from a canonical example.

Maintainers edit route policy under .agents/agent-route-policy.json. Run
`node scripts/agent-routes.mjs --write` to generate the index and individual
routes, and `node scripts/agent-routes.mjs --check` to detect drift. Compiler
identities come from current/compiler-release.json, catalog identities from the
independently admitted candidate, and capability/profile facts from the release
surface authority. Both route generation and the Library control plane use
scripts/release-lifecycle.mjs; a mismatching tag, version, candidate or tested
digest cannot silently yield published states. Direct ordinary Source
Telemetry methods retain five false states independently of related profiles.

`node scripts/test-agent-routes.mjs` executes compiler/hash/Host rejection
controls and pinned Base64/Hex behavior against independent Node byte encoding.
It also checks route mutation, path escape and channel identity conflicts.
The read-only --lifecycle command checks only release.json, channels/prod.json
and the selected candidate. The digest-rejection probe captures an actual
nonzero verifier subprocess and refuses unexpected errors or successful execution.

The v3 learning protocol retains all six v2 prompts and oracles and all existing
model and structural thresholds. It adds four transfer cases: new source,
unfamiliar Hex APIs, wrong independent digest rejection and unapproved clock
imports. The runner disables MCP explicitly, starts each case in a fresh local
Git clone and session, and keeps only public tool/answer records and declared
public source files; hidden reasoning and raw JSONL are not retained.

Freeze a clean guidance commit before using scripts/run-pi-guidance-cohort-v3.mjs
with an exact --commit and an external --out-dir. It runs both declared model
routes in three fresh rounds. Structural success still requires independent
semantic review and replay of the model-authored source. A failed round remains
evidence. Altered guidance requires a new exact commit and a complete new cohort;
do not relax prompts, oracles or budgets to conceal a model failure.

Report correctness and structural efficiency separately from contextual timing
and tokens. Guidance experiment acceptance is not whole-product release admission.
