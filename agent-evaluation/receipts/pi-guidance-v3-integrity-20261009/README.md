# Pi guidance V3 qualification

Tested guidance commit: `46ec2092319beeda9c8cf8da41ea8f57000a9c41`.
Tested tree: `55fd90681ca36da185982d6b4185cfca6f307a0c`.
Protocol SHA256: `cd441d860b43fbd5b424fe53ca3d7532a102975471de20b5fa096ff9282465ba`.

Pi 1.0.4 ran both observed llm-m4dd routes, DeepSeek v4.1 Flash and GLM 5.3
Flash, for three fresh rounds of ten cases each. All 60 cases passed the frozen
structural and independent semantic checks. No tool errors, retries, exact
duplicate calls, timeouts, provider errors, incomplete terminal answers or
published-file edits occurred. Route labels do not attest upstream implementation.

Actual before/after reproductions in important-review.json and its bound receipts
cover the execution-integrity defects: the selected hash-checked raw compiler now
performs compilation, and facade module code is imported only after its digest
passes. Exact u64 max, signed i64 boundaries and unsigned comparison behavior
also pass actual CLI calls. These controls are separate from the frozen Pi tasks;
the live Pi protocol has no dedicated 64-bit authoring case.

The primary reviewer read all public final answers and tool flows independently
of the evaluated Pi sessions. Twelve actual source executions were replayed from
the captured/authored bytes, with matching compiler, source and Core digests,
zero imports, original distinct tuple values and transferred results 17,7,3.
Six additional input-preservation sweeps vary only bool, then vary the numeric
input, preventing ignored parameters or unrequested arithmetic from passing.
Actual Hex round trips, invalid inputs and owned-resource drops were verified;
an independent verifier also returned exit 1 before executing wrong-digest bytes.
See independent-review.json, independent-replay.json and all six model reports.
cohort.json preserves the exact qualified bytes; cohort-index.json provides
portable report paths and binds each copied report by SHA256.

efficiency.json compares the same original six frozen tasks with the earlier
single-round successful v0.0.21 baseline. Three-round medians quantify only tool
calls and returned text. Provider/network timing is contextual; no monetary or
statistical-significance claim is made. Non-blocking extra reads/prose remain
visible in the semantic review. Earlier failed diagnostic cohorts are retained
in diagnostic-ledger.json and are never transplanted into this passing cohort.

For the original six tasks, returned text reductions and tool-call medians are
reported in efficiency.json. refinement-efficiency.json separately compares all
ten unchanged tasks with the prior qualified three-round guidance cohort.
Measured text/calls do not establish monetary savings or statistical significance.

Eleven focused checks passed locally and in the dedicated unreleased-guidance
CI. ci-workstream.json and ci-workstream/ bind the actual successful remote run,
artifact identity, check stdout/stderr and exit status. Broad whole-product CI
remains a separate uncompleted gate. The old v0.0.21 candidate verifier actually exited
nonzero with product drift rejected, as required for this unreleased future
guidance. The nine release/integrity identity files, immutable v0.0.21 tag,
compiler, Provider, complete Roots and SDK bytes remain unchanged.

This qualifies the guidance experiment, not a successor release. Future product
inventory freeze, full release admission and integration remain required.
The receipt/maintainer metadata successor is not the commit Pi directly tested.
