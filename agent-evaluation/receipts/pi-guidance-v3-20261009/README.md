# Pi guidance V3 qualification

Tested guidance commit: `52facc4d06ff9dc530ad7a41bb9ae6e5ccf2a024`.
Tested tree: `e31e7f2e4b3a7136d1a73b24ad57ba3d133f60fa`.
Protocol SHA256: `cd441d860b43fbd5b424fe53ca3d7532a102975471de20b5fa096ff9282465ba`.

Pi 1.0.4 ran both observed llm-m4dd routes, DeepSeek v4.1 Flash and GLM 5.3
Flash, for three fresh rounds of ten cases each. All 60 cases passed the frozen
structural and independent semantic checks. No tool errors, retries, exact
duplicate calls, timeouts, provider errors, incomplete terminal answers or
published-file edits occurred. Route labels do not attest upstream implementation.

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

For the original six tasks, returned text fell by 45.91% on DeepSeek and 48.80%
on GLM. Median tool calls rose from 23 to 27 and from 21 to 25 respectively;
this experiment does not claim fewer calls or measured monetary savings.

Eleven focused checks passed. The old v0.0.21 candidate verifier actually exited
nonzero with product drift rejected, as required for this unreleased future
guidance. The nine release/integrity identity files, immutable v0.0.21 tag,
compiler, Provider, complete Roots and SDK bytes remain unchanged.

This qualifies the guidance experiment, not a successor release. Future product
inventory freeze, full release admission and integration remain required.
The receipt/maintainer metadata successor is not the commit Pi directly tested.
