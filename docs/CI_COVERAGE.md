# Public continuous verification

The source-free repository continuously exercises every current public test
family. It never reconstructs private compiler tests from opaque Wasm, admits
new binaries, changes immutable tags or deploys production.

## Matrix and evidence

Supplemental main additionally checks root release/capability/CDN identity and
all public Skill names and parent chains. Seven rejection fixtures guard stale
guidance, absent standard discovery, missing parents, ambiguity and cycles.
Fresh-Agent acceptance now requires this contract independently of its score.
This does not validate every prose statement or every Markdown reference.
The Runtime SDK tests do not prove the complete App→Std→CoreLib graph on Wasmi;
Std1.4.0's function-reference/tail-call artifact still needs a Portable variant.

The first complete expanded [run34730577345](https://github.com/cbgroom/wasmcrelease/actions/runs/34730577345)
passed all22 jobs (21 suite cells and aggregate), all130 flow checks, and all18
active SDK tests with zero failures/ignored/filtered tests. Source is exactly
`31259c781042a693c05e5b0400e51e9002a66545`. The
[retained JSON snapshot](../admission/public-ci-coverage-v009.json) is independent
of artifact expiry. Hosts were Linux x64 and macOS arm64. Credential scan had
two retained raw findings, zero unresolved/skipped/errors. Deterministic
Fresh-Agent scored100/100 under its documented retained-evidence mode.
Later metadata/checksum updates are not a new exact-source full-run claim.

`.github/workflows/source-free-consumer.yml` runs:

- Six compatibility cells: Linux/macOS × Node18.19.1/22.0.0/26.5.1. Probe,
  identity, catalog, installation-fault and compiler-only assertions run even
  on unsupported std engines. Expected unsupported-feature rejection is not
  full managed/std Host support.
- Twelve full runtime cells: Linux/macOS × Node26.5.1/Bun1.3.14/Deno2.9.4 ×
  GitHub Raw/jsDelivr. Full artifact admission; feature negatives; exact catalog;
  install faults; fresh actual install CLI; installed paired execution;
  30 corpus outputs/23 expression cases/192 managed calls; 5,120 paired standard
  calls. Deployment also executes the compiler/managed/std tests inside an
  archived tree with no Git metadata.
- One integrity/Agent cell: maintainer structure, release/manifest/checksum and
  three historical Lib contracts, public guidance journeys, deterministic
  Fresh-Agent evaluator, and CI reporting failure controls.
- One security cell: full-depth checkout; raw all-reachable blob scanning;
  exact approved historical carrier proof; deleted-credential and unknown-carrier
  negative assertions. Zero unresolved findings/skips/errors is required;
  retained raw findings are not hidden and matched credential values are not logged.
- One Rust cell: stable toolchain versions recorded, `cargo test --locked
  --release` for the executable Wasmtime consumer and public Core Runtime SDK,
  plus `cargo run --locked --release` for compiler/resource/authorized Host
  execution. Both workspaces share one serialized CI target directory with
  two build workers; no local heavy compilation is required for workflow edits.

An always-running aggregate job requires all five job families to succeed and
all 21 unique suite receipts to match the exact current GitHub source commit,
be clean, and report success. Failures/skips/missing reports cannot silently
become green. Cancellation or setup failure may prevent an individual receipt;
the aggregate fails closed when it can run. It is not a signing authority.

Each suite saves exact source, compiler digest, actual Host/platform/version,
test invocation, exit status, elapsed time, structured observations and Rust
test counts. Raw stdout/stderr is kept separately. CI job summaries show
pass/fail; artifacts retain individual logs for14 days and aggregate JSON/
Markdown for30 days. Expired artifacts cannot serve as permanent release proof.
Immutable release qualification remains under admission/ and its named runs.

## README display

README uses the [native GitHub workflow badge](https://docs.github.com/en/actions/how-tos/monitor-workflows/add-a-status-badge)
restricted to main/push. It shows overall current CI status, not individual
test counts. Click into the run's [job summary](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#adding-a-job-summary)
and download [workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts)
for detailed live results. The static README scope table describes configured
tests, not a promise that a pending run passed. No generated README commits,
write-scoped token, external metrics account or fabricated coverage badge.

Coverage here means behavioral test scope. It is not V8 source coverage of
the compiler Wasm or llvm-cov of private Rust. 5,120 paired calls do not cover
all73 APIs exhaustively. Fresh-Agent is a deterministic regression evaluator:
retained provider receipts remain historical, not new same-candidate provider
measurements, novel LLM generation, repair/tokens benchmark or production proof.
No new browser, device, fleet, performance threshold, all-stdlib or third-party
authoring completeness is claimed.

## Reproduce and review

```bash
node scripts/test-ci-reporting.mjs
node scripts/ci-suite.mjs compatibility
node scripts/ci-suite.mjs integrity
node scripts/ci-suite.mjs runtime node github
node scripts/ci-suite.mjs runtime bun jsdelivr
node scripts/ci-suite.mjs runtime deno github
node scripts/ci-suite.mjs security
# Requires Rust; release-profile compilation, no compiler-Wasm rebuilding:
CARGO_BUILD_JOBS=2 node scripts/ci-suite.mjs rust
```

Use a verified clean checkout for admitted source claims. Local dirty receipts
are explicitly labeled and not accepted as CI evidence. Results live under
ignored target/ci; do not commit a machine cache or replace frozen admission
receipts. Workflow PRs use read-only contents permission, no secrets, no
pull_request_target execution and full-SHA-pinned external actions. Security
testing operates only on raw Git objects and controlled fixtures; a historical
false-positive classification never becomes a general detector exemption.
