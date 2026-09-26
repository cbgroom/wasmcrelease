# Lib discovery completeness v1

Status: STARTED / not released.

This workstream fixes a release/discovery consistency defect without modifying
immutable v0.0.13. The released v0.0.13 product set contains thirteen public Lib
package roots, while its legacy resolver catalog still points at the four-package
v0.0.9 snapshot and its shipped LibSearch 0.1.0 index contains five packages /
89 entries.

The remediation is intentionally split:

1. derive package inventory from the exact v0.0.13 frozen product candidate;
2. require explicit reviewed discovery intent for every released package;
3. generate and validate an exact v0.0.13 catalog from that pair;
4. only then rebuild LibSearch 0.2.0 against the exact new catalog and qualify
   its Core, Component and Wasmi behavior;
5. publish only through a future additive release. Existing tags never move.

Automatic inventory does not imply automatic search semantics. Keywords and
representative queries remain explicit reviewed metadata. Missing intent fails
closed. Search remains discovery only and never becomes selection, admission,
engine, or Host authority.

The historical work/lib-discovery-v013 at c2f2dea6 is prior implementation
evidence, not current product identity: its candidate and index were bound to
v0.0.12 and are not reused as v0.0.13 qualification.

## Integrity phase boundary

This branch intentionally changes files that are members of the frozen v0.0.13
product set, so it must not be made to pass the old 0.0.13 candidate verifier.
That verifier is expected to reject the worktree as product drift. Before a new
additive candidate/version is frozen, global v0.0.13 release/manifest/provenance
files remain untouched; workstream-specific validation is the current gate.
Full repository integrity regeneration resumes only after the future product
identity is explicit.

Use `node scripts/validate-lib-discovery-workstream.mjs` during this
pre-candidate phase. It requires every v0.0.13 identity file and the legacy
v0.0.9 catalog to remain byte-identical, runs the focused catalog,
completeness, and install regressions, and requires the old v0.0.13 candidate
verifier to reject the changed tree specifically as product drift.
