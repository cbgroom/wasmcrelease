# Fresh-Agent learning flywheel

## Goal

The flywheel optimizes the public WAsmC release for one affordable operational
unit: a fresh Pi Agent using either `llm-m4dd/deepseek-v4.1-flash` or
`llm-m4dd/glm-5.3-flash`. It does not try to prove universal behavior across a
large Agent/model matrix. Pi should use only a pinned public checkout to form
the correct WAsmC mental model, choose a supported path, stop at unsupported
boundaries, and produce independently verifiable output without retries.

One model run is an observation. The controlled pair is qualified only when
both required Pi routes pass the same frozen suite on the same Pi version and
release commit. The route labels bind observed local configuration; they do not
independently attest an upstream provider implementation. The machine-readable
protocol is `agent-evaluation/fresh-agent-learning-v1.json`.

## Loop

1. Finish every public product, guidance and lifecycle byte; create the candidate
   inventory; assemble the final prod state in an isolated local worktree; and
   commit that release rehearsal without pushing or tagging it. Freeze this
   exact rehearsal commit and tree, the underlying product candidate, prompts
   and evidence-backed oracles. An earlier guidance or product checkpoint is
   not a release qualification.
2. Run every case in a fresh session with no private repository, prior chat,
   memory, maintainer hint or hidden-reasoning dependency.
3. Retain privacy-safe traces and independently verify decisions and generated
   artifacts.
4. Classify failures before changing anything. Model retrospectives generate
   hypotheses; they do not authorize fixes.
5. Repair the smallest correct layer: public guidance, evaluator, producer, or
   tool/environment. Do not relax an oracle to reward a plausible answer.
6. Rerun deterministic release gates and the whole frozen cohort. Version the
   protocol when a case or oracle changes.

## Mandatory pre-release gate

Run the live controlled pair locally after the final prod release rehearsal
commit exists and before publishing its tag:

```sh
node scripts/pi-pre-release-gate-v1.mjs run \
  --commit <exact-local-prod-rehearsal-commit> \
  --candidate channels/candidates/<version>.json
```

The runner first requires `release.json` in that commit to describe the final
suffix-free prod state. It checks every candidate product byte, records both
the rehearsal commit and tree plus the underlying product-candidate identity,
then runs all six cases for both required models concurrently. Every case uses
a fresh detached clone and a fresh Pi session. A clean linked worktree is
sufficient; publication is neither required nor authorized.

The live run is structural evidence only. Independently review each first final
answer against the frozen oracle, create a privacy-safe
`wasmc.pi-pre-release-qualification/v1` receipt, and verify the binding:

```sh
node scripts/pi-pre-release-gate-v1.mjs verify \
  --commit <exact-local-prod-rehearsal-commit> \
  --candidate channels/candidates/<version>.json \
  --receipt agent-evaluation/receipts/<receipt>.json
```

The verifier fails closed unless the receipt binds the same release rehearsal
commit and tree, underlying candidate commit and product-set digest, contains
the exact two-model cohort, and records a structural plus independent white-box
first-pass result for every case. Only after PASS may that exact rehearsal
commit be tagged and pushed. Any later change to product, lifecycle or public
guidance bytes creates a different tree and requires a complete rerun. Store
the receipt after tagging so it does not create a self-referential release
tree. A CI contract test exercises this verifier but is not a live Pi run and
must never be reported as one.

Aggregate an array of `wasmc.fresh-agent-run/v1` receipts with:

```sh
node scripts/fresh-agent-learning-v1.mjs \
  --receipts target/fresh-agent/receipts.json \
  --json-out target/fresh-agent/cohort.json
```

Every receipt binds the exact public commit, Agent implementation/version,
provider/model identity, fresh-session and cohort role, independently assessed
oracle result, evidence digest and privacy-safe structural trace. A model's own
self-assessment is not an independent oracle.

## Admission levels

- Observation: one case on one exact Pi/model route. Diagnostic only.
- Model pass: every required case passes for one model route.
- Controlled-pair qualification: both DeepSeek Flash 4.1 and GLM 5.3 Flash
  pass every case on the same exact Pi version and release commit.

Every case must pass on the first final answer. Structural efficiency—tool calls, turns, result
volume, failed tools, retries, duplicate calls and repeated reads—is a hard
gate. Wall-clock latency is recorded and compared only within the same route
and environment because provider/network time is not release truth.

This is an operational qualification for the selected low-cost pair, not a
claim that all future Agents or models will behave identically.
