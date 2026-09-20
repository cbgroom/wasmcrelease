# wasmc-router-policy — public source candidate

This is the first Host→Lib graduation sample.

The implementation is a new public reference implementation of the observable
routing contract used by the HTTPS qualification workload. The frozen
`router-policy.wasm` remains a behavior oracle only; it is not source
provenance.

Properties:

- zero Host imports;
- pure deterministic routing;
- stable four-scalar input / three-scalar result shape;
- candidate WIT is public and reviewable;
- candidate output is compared behaviorally, not by byte identity.

This candidate is not yet an admitted `libs/` package.
