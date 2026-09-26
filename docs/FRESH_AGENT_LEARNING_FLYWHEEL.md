# Fresh-Agent learning flywheel

## Goal

The flywheel optimizes the public WAsmC release for a new Agent and a new model,
not for one maintainer session or one favored route. A previously unprimed
consumer should use only a pinned public checkout to form the correct WAsmC
mental model, choose a supported path, stop at unsupported boundaries, and
produce independently verifiable output without avoidable retries.

One successful Pi, OpenCode, Codex or other model run is an observation. It can
reveal a documentation, evaluator, producer, environment or model-specific
problem, but it cannot establish portable learnability. The machine-readable
protocol is `agent-evaluation/fresh-agent-learning-v1.json`.

## Loop

1. Freeze the release commit, prompts and evidence-backed oracles.
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

- Observation: one case on one exact Agent/model route. Diagnostic only.
- Combination: every required case passes for one exact Agent version and model
  identity.
- Portable-learning qualification: at least two Agent implementations, three
  model identities, four complete combinations and one blind holdout
  combination pass the cohort gate.

Every critical case must pass on the first final answer. The overall first-pass
rate must be at least 95%. Structural efficiency—tool calls, turns, result
volume, failed tools, retries, duplicate calls and repeated reads—is a hard
gate. Wall-clock latency is recorded and compared only within the same route
and environment because provider/network time is not release truth.

The cohort threshold is a minimum evidence boundary, not a claim that all
future models will behave identically. A new Agent or model family remains a
new observation until it passes the frozen suite.
