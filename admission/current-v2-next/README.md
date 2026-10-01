# Next v2 roots — local qualification, not release admission

Five pending roots have independent complete-package second-build equality
and strict producer reopen: HTTP1, Host Clock, Owned Algorithms, Resource Counter
and Data Core. Data Core lives in the sibling `current-v2-data-core` batch.
Only generated WIT/Core/Component/SDK/metadata is carried here, not compiler or
private adapter implementation. Exact source and toolchain facts are retained
in build receipts. New material follows the repository research-only license.

Run `node scripts/qualify-current-v2-next.mjs` for pinned inventory checks,
HTTP1's 1,422 cases, Data Core's ten Component cases, representative Wasmi 2.0.0
execution of both exact Core artifacts, and five generated-SDK Rust consumers.
Each consumer runs 128 rounds; Data Core additionally checks all six types,
nulls, u64 maximum, signed minimum, row order, empty/zero-column selection and
out-of-bounds errors. Clock bindings and counter destruction are explicit.

`empty-take-regression.json` retains the original Data Core failure and the
source-bound repair. Do not rewrite that failure as an earlier PASS.

These roots are not selectable through the current catalog or a new immutable
release. Upstream provenance review, ordinary WAsmC App use, current catalog/
search/install binding, remaining qualification and exact future-candidate Pi
release gates remain separate. Core/Component/SDK success does not qualify any
absent consumer or platform.
