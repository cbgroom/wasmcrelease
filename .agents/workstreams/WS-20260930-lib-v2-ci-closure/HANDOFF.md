# Lib v2 CI closure

Task state: in-progress

Objective: validate current v2 discovery and package bytes independently from
the immutable v0.0.20 release, retaining rejection of future product drift.

Expanded objective (user requested all-package closure): rebuild and qualify
the pending roots, then bind catalog/search/install and an exact future release.
Do not stop at discovery-only improvements or relabel intermediate receipts as
release qualification. Existing producer WIT-dependency edits remain unowned here.

Base: origin/main 4ca6374da5521d25b3c1c0449d1c6dfb9cffe811.
Claims: current-v2 validation scripts, discovery teaching, CI routing and this
workstream. Existing producer WIT dependency WIP is owned elsewhere.

Plan: reproduce current discovery failure; verify package inventory and runtime
views; route mutable branch checks to current gates and immutable-tag checks to
release gates; test rejection controls and preserve all release identity files.

Validation: current catalog and migration closure, documented searches, complete
package digest inventory, old-candidate drift rejection and focused CI routing.

Implemented: restored API-level LibSearch queries with catalog identity filtering
and path mapping before paging; explicit historical catalog teaching; current
development preflight and CI routing independent of immutable release-tag gates.
Release identity metadata remains byte-identical to pre-migration c49bfcd.

Evidence: documented searches PASS; five current packages pass producer strict
reopen using the clean 3b797a77 builder; five discovery queries, four excluded
packages, 96 paged hits and three invalid pagination controls PASS. Current
 development suite 12/12 PASS; CI reporting and tag/branch routing controls PASS.
Default current API search previously returned no hit for base64 decode; it now
returns the exact typed API. Old v0.0.20 candidate still rejects future bytes.

Install evidence: all five catalog packages resolved, downloaded from their
exact 4c25aafc GitHub commit, installed and reopened with exact digest locks.
Five no-clobber and five tampered-download rejection controls PASS. Controlled
offline installs are part of CI; the live GitHub run is separate network
evidence, not an ordinary App runtime or jsDelivr qualification.

Hosted CI on 3876c85 caught Node 18 incompatibility in the teaching test and
the stale v0.0.20 ecosystem/current inventory mismatch. Fixed the portable
path API and added explicit frozen-release-ecosystem validation: current
catalog preflight is mandatory, current roots/workflows are checked, frozen
ecosystem comes from exact c49bfcd, and a release tag cannot opt into this mode.
Node 18.19.1 current preflight PASS; no release identity metadata was refreshed.
PR: https://github.com/cbgroom/wasmcrelease/pull/23 (not merged).

Second slice: added current-development compact quickstart, exact route/digest
oracle, CLI help, a fresh Pi discovery observer with explicitly typed protocol
v2, and child-command reported-failure accounting. Original round1 failures
are retained in pi-discovery-round1.json, not reclassified as model PASS.
Current installed Std executes six Core Base64 calls and drops all nine buffers.
The behavior oracle is shared with the frozen-package example; the immutable
tag and package bytes are unchanged. This is not ordinary App qualification.

Hosted checks on 5d080ee: current-v2 and the restored search/teaching gates
PASS. Optional Intel HTTPS performance reports WouldBlock; preserve that
separate failure rather than weaken or relabel it. Revised live observation
requires a new exact committed checkout; do not bind it to dirty bytes.

Round2 at f1dc1fa: DeepSeek discovery observation PASS (11 tools, 44.6s).
GLM has correct facts/digests with eight tools in 48.7s, but a prose prefix
violates the exact JSON response contract, so strict observation remains FAIL.
Neither route has tool/provider errors or retries. Both read the selected
Skill/WIT. Independent review accepted the ambiguous excluded_examples naming
and changed it to current_catalog_membership; feedback about AGENTS ordering
was contradicted by the file and rejected. Retain pi-discovery-round2.json.

Round3 at exact a355b3aabc26154442bb57c8de763ba57d1f4460 uses the same typed
v2 prompt/oracle as round2. Both routes PASS the one discovery case: nine tools
each, zero tool/command failures and provider retries, 21.9s DeepSeek / 54.5s
GLM. Both read selected Skill/WIT and run default search/current preflight;
independent review checks facts and digests, not their self-assessment. Retain
pi-discovery-round3.json. This does not qualify the full frozen release cohort
or a later receipt/test commit.

All current selected WIT exports now close against actual paged CLI results:
five package routes plus 91 API routes, exact paths and no extras. Three
missing/extra route controls reject. This reuses the released route-set oracle
without promoting or rewriting the immutable release closure.

Resume: review hosted CI on this branch/PR, then integrate serially. WIT
dependency support and thirteen package rebuilds remain separate unfinished
work. Three live discovery rounds have been performed, but the full frozen
release cohort and a new release have not been performed.

## Actual package rebuild slice

Five more roots have been rebuilt with the clean synchronized private producer
3b797a77 and Rust 1.96.0: HTTP1, Host Clock, Owned Algorithms, Resource Counter,
and Data Core. For each, two isolated complete package trees are byte-identical
and producer strict reopen passes. Only generated package bytes are staged in
`admission/current-v2-next` and `admission/current-v2-data-core`; no private
implementation/compiler source is published. Old roots and release metadata
are unchanged. The three source-recovery entries now have recovered canonical
source and exact WIT matches; their catalog statuses remain pending admission.

`scripts/build-current-v2-portable.mjs` stages exact Git source inputs in an
explicit private producer output directory. It forbids reused output and dirty
producer input. `scripts/stage-current-v2-next.mjs` compares both package trees
with their pinned inventories before copying any reviewed delivery bytes.

HTTP1 exact new artifact: 36,774 bytes, SHA256
e7615622fd807230ab6d8da08c064f23a66ee3b72f57ab0ddc8295c845d0a060,
0 imports, 1,422 behavior cases PASS, Wasmi 2.0.0 128 framing rounds PASS.
Data Core: 868,911 bytes, SHA256
2033910ed2c4130db930d289787204181b6d9fed94bdbcbde9651eaab949f313,
0 imports, six Wasmtime Component behavior/error cases PASS.
Generated SDK-only Rust consumer: four packages, 128 rounds each, HTTP1 768
calls, owned 1,024 calls, clock 256 explicit Host calls, 129 counter lifecycles;
missing Host binding and stale resource both reject. All dependencies compile
offline/locked from generated public root SDKs; provider implementation is not
a Rust source dependency. This is not ordinary WAsmC App consumption.

Reproduce: `node scripts/qualify-current-v2-next.mjs`. The receipt at
`admission/current-v2-next/qualification.json` binds all five staged roots.
Current selectable catalog remains five roots; staged roots are deliberately
not installable/current or released yet. Thus protocol build progress is 10/18,
but catalog migration remains 5/18 and full release is not complete.

Remaining eight unrebuilt roots: CSV, Data Expr/Compute/Relational/Profile/
Interchange (canonical dependency WIT inputs require the other workstream's
uncommitted support), Router (standalone WAT currently rejected by the Core
composition input's 1..64 dependency requirement), and System Telemetry
(real-provider qualification). Do not invent a dependency for Router, inline
WIT to conceal imported identity, consume someone else's dirty patch as clean
producer authority, or claim telemetry real IO from a simulator.

Next: close upstream provenance/licensing and Data Core engine/SDK gates;
admit the five staged roots into a new pinned current catalog and re-run every
WIT route/install; coordinate clean WIT dependency integration for the six
remaining data roots; provide a real zero-dependency Core publication path or
a reviewed Router producer; close telemetry real provider and ordinary App
evidence; only then freeze the next product and run exact live Pi release gates.
Hosted PR checks before this slice: 114 success, two expected perf-publish skips,
one optional Intel HTTPS performance failure; no failure has been hidden.

Source repair checkpoint: Data Core empty/zero-column `take` failed as
invalid-layout on both Wasmi and Wasmtime, although `validate` accepts the
input. Arrow `RecordBatch::try_new` cannot infer rows without columns. Preserve
the selected-index length through `RecordBatchOptions::with_row_count`; three
native tests PASS for empty input, duplicate selected indices and invalid
indices. The initially staged Data Core bytes above are superseded candidates,
not admissible evidence for this fix. Rebuild twice from this source checkpoint
in the clean private producer, then replace the uncommitted Data Core staging
batch and run exact Component/SDK/Wasmi regressions. Keep old released roots
unchanged. The regression stays strict rather than accepting invalid-layout.

Final package-validation checkpoint supersedes the pending rebuild instruction
above: repaired Data Core was rebuilt twice from exact public source
3270e4c3d504e12a899464f115542a8efc578b06 through the clean private producer.
Complete package trees match and strict reopen passes. New Core is 868,932 bytes,
SHA256 255d4625fa7f3f8bbea534476e862475585acb59edf3cff19c7e01eff736d823;
Component SHA256 43a459ec14187b333fd091cb6ad410669e7d65050c77829fe98f460c7f1ca63d.
Ten Component cases PASS, including empty/zero-column selection and invalid
indices. Wasmi 2.0.0 executes 384 empty-batch validation/take/error/cleanup calls
across 128 rounds (representative scope, not Wasmi six-type conformance).
Generated root-SDK consumers now cover all FIVE staged packages: Data Core 896
calls across six types, nulls, full-width integers, row order and empty cases,
plus all earlier HTTP1/owned/clock/counter checks. Ordinary WAsmC App is false.

The failure/repair receipt is `admission/current-v2-next/empty-take-regression.json`.
Old local staging was moved recoverably into ignored
`target/current-v2-data-core-before-empty-take-fix`; old released roots are
unchanged. Exact package-byte/SDK qualification is wired into Lib source CI,
fetching only public engine dependencies before locked/offline consumption.
No new hosted PASS is claimed. Local current development suite remains 12/12
PASS and the six old release identity files remain unchanged. Do not refresh
old release metadata. Next: upstream/license/App admission and a new exact
catalog for these five roots, followed by the eight remaining rebuilds and
full future-candidate Pi/release gates. Source recovery is now complete for the
three fixtures even though the current catalog ledger still excludes them.

Machine migration ledger now agrees with that evidence: source recovery pending
0, qualification pending 5, unrebuilt 8, current selectable 5. Staged manifest,
Core and Component hashes plus both Agent views are checked by current closure;
these checks do not admit staged roots into discovery. The thirteen total
non-current roots remain excluded. No catalog authority or release pointer
has advanced.
