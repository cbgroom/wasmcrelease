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

## Exact Wasmi fixture and primary-upstream closure checkpoint

All five staged packages now have exact Core Wasmi probes plus generated
Wasmtime Component SDK execution. New Wasmi scope: Owned Algorithms 1024 calls
over all four APIs (UTF-8, empty inputs and full-width i32 sums); Clock 256
calls plus missing and wrong-signature import rejection; Counter 128 lifecycles
with explicit destructor execution and balanced embedding resource table.
Counter's imported resource-drop callback is bound but NOT executed by this
Core probe. Stale representation absence is an embedding-table observation,
not a claim that raw provider pointers are safe. Canonical Component drop and
stale-handle rejection remain separately covered by the root SDK consumer.

`scripts/current-v2-upstream-provenance.mjs` captures official exact Git tags,
commit/archive hashes, seven Cargo.lock registry archive checksums and compares
all packaged upstream src/*.rs bytes with those exact official commits. The
review binds delivered Core/Component/lib.json, adapter source, Cargo.lock and
the repository research license; it never edits nine-file package inventories.
Fifteen upstream LICENSE/NOTICE files are retained, including arrow-array's
Apache-2.0 AND MIT obligation. Supported/unsupported subsets and adapter-owned
deltas are explicit. Offline reopen and eighteen mutation/link negative controls
are wired into public CI. No upstream license is replaced by the adapter license.

Review receipt: `admission/current-v2-next/upstream/review.json`.
Full transitive license audit is FALSE; the seven reviewed crates are the
primary semantic dependencies, not all build/runtime Cargo dependencies.
Package license binding, ordinary App admission and current catalog/search/
install closure remain pending. Protocol builds remain 10/18, selected roots
5/18; eight roots are unrebuilt. The WIT-deps producer worktree still has its
owner's ten uncommitted files at 3b797a77 and was not modified or adopted.
Next use matching clean producer authority for ordinary App evidence; complete
transitive/license admission before a future candidate. Do not promote these
sidecar receipts to a release or relax any old-candidate drift rejection.

## 2026-10-01 source-free SDK and HTTPS startup repair

Five staged generated SDKs now compile and execute in a separate 48-file
consumer tree: exact nine-file roots plus Cargo.toml/lock and consumer main.
No compiler/provider/adapter/upstream semantic sources are copied; public engine
registry sources and compatible Cargo build caches remain allowed. Exact roots
match both independent build inventories; before/after consumer inputs match.
Receipt: `admission/current-v2-next/source-free-sdk.json`; oracle is
`scripts/qualify-current-v2-source-free-sdk.mjs`, wired into exact qualification
and public CI. All five 128-round SDK journeys pass. Ordinary App remains false.

Actual remote failure at 9f498ab: Host HTTPS flywheel run 36774756671,
job 110089765924 (macos-15-intel) reports baseline exit 1 / OS code 35 WouldBlock.
The prior trace has no phase marker, so exact Intel failure phase is not proven.
Static harness inspection and a real TCP reproducer show a startup race:
listener bind precedes ServerRuntime module compilation/instantiation, while the
client connects immediately under a 5-second socket timeout. Readiness now
waits for successful initialization with a separate bounded 30-second limit,
preserves the original error, and keeps missing/panicked/failed initialization
fail-closed. No request retry, Host API or Lib bytes changed. Four regression
tests pass, including old-path timeout and new-path delivery with equal I/O
deadlines. Baseline clippy passes under the existing CI warning policy.

Real local ARM macOS HTTPS evidence: `https-startup-macos-aarch64.json` retains
the complete two-lane 256-request forced-seven-byte-write qualification plus
warmups and six alternating 1-second A/B pairs. All parity/lifecycle gates pass;
report hashes bind revised main/startup sources and both binaries. Intel/other
new-commit cross-platform results are pending, not inferred from ARM success.
Startup is now outside the request timing interval, so aggregator rejects
mixed epochs and omits historical numeric deltas against the older interval.
Ten timing tests include actual aggregator fixtures; cloned synthetic platform
rows are negative-test inputs only, never qualification. No throughput/SLA or
production-default claim follows from hosted or local ratios.

Global package counts remain 10/18 built, 5/18 current-selectable, eight
unrebuilt; staged qualification is not admission. Next: clean matching producer
ordinary App evidence, complete transitive/license binding, current route/install
admission and remaining package rebuilds. Preserve other owners' dirty WIT work.

## 2026-10-01 ordinary App puncture and nested CI routing repair

Matching clean producer 3b797a77 with the existing core-runtime-sdk feature
profile now compiles an ordinary Host Clock App (113 bytes; SHA256
b81202c3f0eb27af2a28486fdf3f6c01bf20dab563a7c7cfab30f7c414198e1a).
The actual App calls the exact staged provider, which calls the explicitly bound
Host clock; 640 calls / 128 rounds pass, including wrapping full-width inputs,
missing Host/provider rejection, non-function binding rejection and original
Host exception propagation. Public replay needs only delivered App/provider
bytes, not private compiler or provider source. Node 26.5.1, Bun 1.3.14 and
Deno 2.9.4 local replays pass. Bun initially failed the test's import descriptor
comparison because it includes extra type metadata; compare the standard
module/name/kind fields, not an engine-specific object inventory.

Receipt: `admission/current-v2-next/ordinary-app.json`; retained App/source in
`admission/current-v2-next/apps`. Maintainer-only probe rebuilds the matching
compiler library in the private tree; public CI only replays the retained App.
Fifteen independent mutation controls reject altered identities, erased blockers
and false all-package/catalog/release claims. Exact batch qualification binds
the receipt and executable public replay; it remains all-package App FALSE.

HTTP1, Owned Algorithms and Data Core reject their complex WIT inputs; Resource
Counter rejects constructor/method transport. All four actual rejections occur
at namespace Core transport admission BEFORE source-body type checking. Their
snippets are diagnostic triggers, not validated future App examples. Do not
special-case these packages, leak raw handles or declare fake Host imports to
conceal the missing generic binding/lifetime mechanism. Staged App gate is 1/5
locally, not 5/5 and not released compiler qualification. Next producer slice
must close generic rich-value/resource Core transport with exact WIT plans and
independent ordinary-source/SDK parity, without altering Host API.

An independent producer default-build failure is retained in
`producer-build-blockers.json`: Wasmtime-only default Cargo build fails E0432/
E0425 around EPOCH_TICK_NS; runtime-neutral build succeeds but lacks catalog
resolver API. Existing dual-runtime profile passes. No producer implementation
was modified; the default feature-gate repair remains required.

Remote d517386 run 36777376287/job 110098577887 failed the Host boundary
aggregate's nested release-surfaces call (3 != 22). It still used live current
ecosystem against frozen release counts. The aggregate now selects the existing
frozen-release-ecosystem check only for current development, including its full
preflight and old-candidate rejection; tags retain strict release checks.
Routing regression verifies the guarded nested call and rejects tag override.
This is not a count rewrite or gate waiver. Hosted Intel HTTPS is still pending.

Counts remain 10/18 built, 5/18 selectable, eight unrebuilt. Full transitive
license audit, explicit package license binding, new catalog/search/install,
matching published compiler and exact future-candidate Pi/release gates remain
pending. The release-integrity and agent-doc Skills remain current; integration
Skill now records early App admission and engine descriptor distinctions.

Final local checks: exact five-package qualification and source-free SDK PASS;
current candidate suite 13/13 PASS (including actual App replay); Host boundary
aggregate PASS with all thirteen focused checks and old-candidate drift
rejection. Routing/tag-override controls, fifteen App negative controls,
research-license policy and diff whitespace checks PASS. Hosted checks must
qualify the next committed checkpoint independently, not these dirty bytes.

## 2026-10-01 exact licensed distribution closure

Current live ownership check found a newly active
`WS-20261001-fuel-observation-v1` exclusive claim on the entire
`crates/wasmc_core_runtime` directory. It initially had dirty implementation;
during this turn its owner pushed c169f47189217d3b98f12e19be8ba6f866582862
and the tree became clean. That revision still gates EPOCH_TICK_NS on Wasmi;
it is not a fix or master integration. No source/claims were edited here.
Do not overwrite or independently integrate this unfinished runtime work.
The WIT-dependency producer implementation likewise remains separately owned.

Safe non-overlapping work closed the exact license binding for the five staged
roots. `scripts/current-v2-package-license.mjs` emits a distribution manifest
binding each exact lib.json/Core/Component/generated SDK and all other root
files to independent first/second producer inventories, plus research LICENSE,
license-policy, primary review and fifteen notices. Strict nine-file package
roots are byte-unchanged. Upstream terms and earlier grants are not overridden.
`package-license-bindings.json` is outer metadata, not a generated-schema change.
Future candidate MUST carry that envelope or equivalent exact binding; a bare
root without the license envelope is not authorized by this gate.

Fresh licensed distribution: 66 exact files, five roots. Thirty-five JSON and
real-filesystem negative controls reject missing/tampered licenses and notices,
linked files/directories, extra source, self-rehashed replacement, dropped root,
clobber/reuse and false commercial/production/upstream/release claims.
Actual HTTP1 oracle from the copied tree passes 1,422 cases. Adding only the
three public consumer files gives 69 inputs; locked/offline generated SDK
execution passes all five packages and leaves every input byte unchanged.
No compiler/provider/upstream semantic implementation is copied. Engine Cargo
registry and compatible caches remain public consumer toolchain inputs.

Exact batch qualification, current closure and public Lib CI now require the
binding/isolated-delivery oracle. Developer candidate suite gains its own
license-binding case. Complete dependency/toolchain license audit remains
FALSE, including three canonical adapter builds and generated-SDK engine deps;
the seven primary crates are not a full dependency inventory. No new candidate
or catalog admission is claimed. Read docs/CURRENT_V2_LICENSED_DELIVERY.md.

Hosted evidence refreshed at exact 7f45899804b47c7960928606b11cebdcc1ad6d02:
Host Lib-defined boundary run 36779278808 SUCCESS confirms the previous nested
CI routing repair. Public Lib source incubation run 36779278979 and revised
Intel HTTPS remain pending; no hosted claim applies to this newer dirty stage.
Counts remain 10/18 built and 5/18 selectable; App locally qualifies 1/5 staged
packages, not all five. Next: close remaining dependency/toolchain audit;
coordinate runtime-directory ownership before default feature-gate repair;
generic rich-value/resource Core transport, remaining eight builds, new
catalog/search/install and exact future-candidate Pi/release gates.

Final local validation: exact five-root Core/Component/SDK qualification PASS;
licensed SDK isolation and 35 negative controls PASS; candidate suite 14/14
PASS; license policy, tag/development routing and diff checks PASS. Only this
workstream's release metadata/glue changed; all generated nine-file package
roots, compiler/Lib bytes, current selection and frozen release identity files
remain unchanged. Owning release-integrity Skill records the outer-envelope
rule; other selected Skills retain their current boundaries. Push this coherent
checkpoint and qualify its new hosted CI independently.

## 2026-10-01 100-percent closure loop: dependency materials

User requested an explicit loop toward 100-percent all-Lib closure. An active
goal retains the full 18-package denominator and existing gates; no difficult
package or missing authority was removed. Runtime default-feature repair still
overlaps the exclusive fuel-observation claim. Coordination authorization was
requested; no messages, claim takeover or producer edits occurred here.

Implemented a checksum-bound conservative dependency inventory for HTTP1,
Data Core and the five-generated-SDK consumer: three exact public Cargo.lock
inputs, 175 registry crates, all 175 archives verified. The first capture found
15 archives without conventional packaged notices. r-efi's AUTHORS contains
the complete MIT grant/copyright material; the filename heuristic was repaired.
Fourteen Wasmtime/Cranelift notices were recovered from exact archive-derived
VCS commits. Original Cargo.toml bytes independently match that upstream commit
before its root LICENSE (with LLVM exception) is accepted. No main/latest
fallback, generic substitute license or implementation-source copy.

The inventory records original packaged omissions separately from supplemental
materials. There are now zero missing notice materials within these three
lockfiles. Twenty-three mutation/parser controls reject dropped/changed input,
crate/checksum/order drift, notice tamper, traversal, mutable upstream URL,
changed VCS identity and false full-audit/release claims. Candidate CI replays
the public receipt offline. See docs/CURRENT_V2_DEPENDENCY_INVENTORY.md.

Complete audit remains FALSE: three canonical adapter lockfiles, Rust stdlib/
toolchain materials, obligation/target review and carrying these materials in
the future licensed delivery are pending. Existing 66-file envelope and all
generated package bytes remain unchanged. Build/catalog counts remain 10/18
and 5/18; this audit slice does not advance admission or immutable release.

Hosted 242f607 source-incubation validate job 110111673720 failed two current
development preflights (run 36781220859). It used checkout fetch-depth=1 and
did not preserve failed suite logs. A fresh depth-one clone of exact 242f607
reproduces missing c49bfcd release.json at git-show. The validator still
requires that exact immutable baseline; no fallback or hash weakening was added.
The validate job now checks out full history and always uploads target/ci
diagnostics. Routing tests guard both requirements and existing tag rejection.
This local shallow-clone reproduction is evidence, not a new hosted PASS.

The executable history regression creates its own temporary Git fixture from
the exact committed source, proves the specific shallow failure, fetches full
history, then proves complete development preflight and old-candidate drift
rejection without tracked changes. Local PASS at 242f607; no hosted claim.

Local candidate suite 16/16 PASS; dependency controls 23/23 PASS; research
license policy, routing/tag controls and whitespace checks PASS. The current
milestone needs its own clean commit/push and hosted qualification. The runtime
owner remains clean at c169f471; its default-feature constant gate is unchanged.

## 2026-10-01 adapter inputs and official toolchain copyright closure

Previous goal turn was progress: c0191b2 committed/pushed executable dependency
material and shallow-history repairs. Live public source-incubation run
36783742678 completed SUCCESS at that exact commit, confirming the checkout
repair. Current-v2 job 110120054751 also SUCCESS. Neither proves the newer
audit stage or all-package release.

Recovered the three canonical adapter Cargo.lock inputs as metadata only.
HostClock and ResourceCounter first/second retained build inputs are byte-equal
and match each delivered manifest. OwnedAlgorithms' generated temporary lock
was deleted by its producer; its exact two-local-package bytes are recovered
by full manifest build-input SHA256 equality. Zero registry dependencies in
that adapter; not merely a regenerated compatible lock. No private path or
compiler/adapter source is copied. Selected private builder remains clean at
3b797a77; no implementation files or other workstream claims were changed.

Conservative closure now covers six exact lockfiles, 189 registry crates and
189 verified archives, with zero missing notice materials. Twenty-eight JSON,
parser and actual file controls reject dropped/tampered inputs, linked files/
directories and invalid full-audit claims. New adapter inputs are outside the
strict nine-file Lib roots.

Two Rust 1.96.0 copyright HTML documents are now bound to all five exact
package-builder fingerprints. The full official rustc archive matches pinned
distribution SHA; both documents match the installed builder byte-for-byte.
Compressed delivery is 444754 bytes; plain content and compressed bytes have
independently pinned digests. Public replay is offline and copies no Rust/WAsmC
compiler executable or implementation. Twenty-eight schema/claim/file controls
reject dropped/changed/self-rehashed/linked documents, linked receipt, extra
source, mutable distribution identity and false audit/release claims.

Failures retained as lessons: direct versioned docs endpoints returned 404;
the checksum-valid rust-docs archive does not contain these copyright lists.
Installed component manifest assigns both to rustc, not docs. The first
version-fingerprint probe also correctly rejected untrimmed terminal newline;
matching producer semantics uses trimmed UTF-8 verbose version output.
An initial direct rustc download timed out; the terminal handle was checked,
then bounded capture succeeded without downgrading SHA verification.

Dependency receipt now binds the toolchain material receipt. Still FALSE:
full_transitive_license_audit and release_qualified. Remaining license work is
explicit obligation/target review and carrying this complete scoped material
set into the licensed distribution with isolated reopen/tamper controls.
Existing 66-file envelope, package bytes, current catalog and frozen release
identities are unchanged. Package counts remain 10/18 built, 5/18 selectable;
generic App transport and eight remaining builds are still required.

Local checks: candidate development suite 17/17 PASS; dependency controls
28/28 and toolchain controls 28/28 PASS; exact five-package Core/Component/
generated-SDK qualification and licensed source-free SDK replay PASS. Research
license policy, routing/tag rejection and diff checks PASS. Owning release
integrity Skill records exact input recovery and official component ownership;
no producer implementation/strategy Skill was changed. Commit/push this
milestone and keep full-audit/release acceptance false pending the next gates.

## 2026-10-01 material-carrying licensed recipient closure

Previous goal turn was progress: 5b1e02d pushed exact adapter lock recovery and
official toolchain materials. Live current-v2 run 36786586753 completed SUCCESS
at that exact commit. Runtime owner remains c169f471; no takeover or producer
implementation edits occurred. Ordinary rich-value/resource App transport and
remaining eight builds are still open.

Expanded the outer licensed envelope to carry the actual conservative audit
inputs and materials: six locks, 189-crate inventory (embedded exact notice
texts), pinned toolchain receipt and two compressed copyright documents. Five
strict nine-file roots and all compiler/provider bytes are unchanged. The new
76-file capsule is reopened against trusted producer inventories and independently
pinned material identities, not a recipient's self-authorized file index.

Forty-nine JSON and actual-recipient controls reject missing/tampered audit
material, self-rehashed inventory and outer manifest, linked toolchain document,
false material counts/claims, missing license/notices, extra source and root
inventory drift. Existing no-clobber and linked-parent rejection are preserved.
HTTP1 executes 1422 exact delivered-artifact cases. Adding only public consumer
Cargo.toml and main.rs yields 78 files; its Cargo.lock is already carried and
must match rather than be overwritten. Locked/offline Wasmtime49 generated SDK
execution passes five packages with unchanged complete before/after inventory.
No private compiler/provider/upstream implementation is copied.

Batch qualification now binds the widened envelope and its inventory/toolchain
validators' source hashes. Development closure checks the carried-material
facts (189 crates, six locks, two copyright documents, 78 consumer files).
This closes scoped material delivery only. Both full_transitive_license_audit
and release_qualified remain FALSE; per-root pending license work is explicit
obligation/target-applicability review, not the now-closed input/material gaps.
Global counts remain 10/18 built and 5/18 selectable; no old identity was
refreshed or a new candidate allocated. Next: obligation review, generic
ordinary App transport, eight builds and complete candidate route/Pi/release
gates. Coordinate the runtime directory before the default-feature repair.

## 2026-10-01 explicit registry notice-choice review

Task state: in-progress. The previous material delivery checkpoint c0d7ca3 is
pushed and clean, with post-commit 17/17 development checks PASS. This slice
adds a finite explicit choice/evidence plan for all 189 registry identities and
17 expressions, without claiming a general SPDX parser or legal approval.

MIT alternatives are explicit; every AND term remains, including Arrow Array,
encoding_rs BSD data and unicode-ident Unicode data. Slash forms retain both
terms without inferring OR. LLVM exception text stays with the full Apache
notice and no omission/waiver is relied upon. r-efi selects its declared MIT
alternative with exact AUTHORS material. All original notices stay carried.

Validation: 27 negative controls reject false full-audit/release claims,
missing AND-term notices, removal of exact LLVM supplementation, self-rehashed
Apache truncation and unreviewed expressions. Local candidate development
suite 18/18 PASS; CI routing PASS. The five strict generated package roots and
the 76-file envelope are unchanged. The new review receipt itself is not yet
carried; bind it without creating a receipt/envelope hash cycle. Modification,
target/toolchain review and all other package cohorts remain pending. No new
hosted check or all-package audit PASS is claimed.

Fresh private orientation: clean producer 3b797a77; global HANDOFF still names
the integrated finite scalar-record transport. Public complex-value App probe
remains 1/5, with four namespace rejections before body checking. The available
wasmc-bootstrap is not on PATH; its absolute-path maintainer-check against the
clean producer rejects with status 24. Exact inspection identifies the
standard-library Skill at 510 lines (500-line gate), not a compiler pass.
Do not restore the deleted orientation script referenced by stale loop text.

The runtime branch is still clean/pushed c169f471, started/not-ready, and
exclusively claims crates/wasmc_core_runtime; the owner thread is idle, which
does not release that claim. Its latest user direction rejects third-party
Wasmtime patching. No message was sent, no runtime code changed, and no engine
patch is part of this task. The WIT-dependency worktree still has ten dirty
paths and no registered task found; do not integrate those as clean authority.

Next: obtain authorized ownership coordination for the default-feature repair
and WIT work; repair the private maintainer preflight without deleting
knowledge or weakening its limit; start a properly claimed generic App
transport slice. In parallel, bind the registry review and verify actual
build-source modifications and target/toolchain obligations. Keep the original
18-package denominator and matching compiler / exact Pi pair / release gates.

Prior material-delivery local checks: material-carrying isolated SDK and 49 controls PASS;
exact five-package qualification refreshed PASS; candidate development suite
17/17 PASS; tag routing, research-license policy and whitespace checks PASS.
Owning integrity Skill records carried-input validation and exact lock reuse.
Checkpoint this unreleased slice; no old-version integrity refresh is permitted.

## 2026-10-01 acyclic registry review delivery

Task state: in-progress. This section supersedes the prior pending review
carriage instruction. The original 18-package denominator is unchanged.

The review now binds only exact inventory inputs, not its carrying envelope
or its own delivery-success assertion. The envelope independently validates
and carries that review: 77 exact files, with 79 in the SDK-only consumer.
Two ordered review/envelope recaptures are byte-identical. Validating the
review no longer recursively validates an index that will bind its own bytes.

Actual isolated delivery rejects review deletion, mutation, symlinks and a
self-rehashed review plus self-rehashed envelope that removes Arrow Array's
AND term. Total recipient rejection controls: 56 PASS; registry review
controls: 27 PASS. Exact delivered HTTP1 executes 1,422 cases. All five
generated SDKs execute again with 128 rounds/package, including 896 six-type
Data Core calls; the 79-file tree is unchanged before/after execution.

Full five-package qualification is refreshed, binding both new review
oracles and the review bytes separately. Wasmi/Component behavior, source-free
SDK and current ordinary App checks pass within their existing scope; ordinary
App is still only 1/5. Strict nine-file roots are unchanged. No private
compiler build/source, Host API, old immutable release or catalog changed.
Local candidate development suite 18/18 PASS, research-license policy PASS
through scripts/validate-license-policy.mjs, and git diff --check PASS.
No all-checks hosted PASS for this new slice is claimed.

Next: verify actual registry/build-source modifications and patches, then
target/toolchain obligations; include all remaining package cohorts. Resolve
private preflight and claimed/dirty ownership before compiler, default build
or WIT edits. No owner message has been authorized or sent. New candidate,
matching compiler, all-package routes/install, exact dual-model Pi and release
remain mandatory, not implied by these local material gates.

## 2026-10-01 producer workspace input guard

Task state: in-progress. Inspection of the five exact staged manifests finds
only Cargo.lock in build.inputs; retained workspace source remains available,
but the original build receipts did not attest to source stability around
execution. Do not promote a retrospective snapshot into historical proof.

The portable build runner now captures a read-only workspace/WIT/config/license
witness before and after real producer execution and rejects changed inputs.
Two independent builds must have equal witnesses. New staging requires both
witnesses and rechecks actual retained inputs before copying package bytes.
Private implementation contents are never copied into public metadata.

Independent fixture controls: 13 PASS across all eight input classes,
deletion/addition, linked source and linked workspace. Source under src/target
is retained; only crate-local Cargo output is excluded. This is a guard test,
not a real rebuilt-package or registry-source audit. Existing five package
roots and their prior qualification receipts are unchanged. Local development
candidate suite 19/19 PASS before this checkpoint.

Next: checkpoint this guard before using it (the build runner reads committed
Git inputs), then run the guarded private producer on the staged cohort in new
output directories and require exact complete-root equality plus actual
pre/post-build witnesses. Free disk observed 108 GiB; do not cold-build the
compiler or overwrite retained outputs. Continue registry source and external
generated-adapter/toolchain audit separately. Keep all package counts, App,
source ownership and full release blockers unchanged until their own evidence.
The actual builder entrypoint also rejects a dirty public Git fixture before
touching any private producer/output path. Metadata order uses UTF-8 bytes,
not locale/ICU sorting. Both public script and Git input identity must be clean.

## 2026-10-01 actual guarded HTTP1 dual rebuild

Public input 22341148a11d4154b156e3d2bf98d77c7cf4bbbc, clean private producer
3b797a77d0afa25264a11362603b0d596d2e0ba7. Private retained output is
current-v2-builder2/target/portable-v2-source-witness-http1-r8. Two actual builds
PASS, each with unchanged nine-file input witness; witnesses are equal.
Separate recheck of both retained workspaces PASS. All nine generated delivery
files equal both each other and the existing staged HTTP1 0.0.1 root, including
manifest, SDK, Skill and agent delta, not just Core/Component. Source-free
receipt: admission/current-v2-next/http1-build-input-witness.json. This outer
audit record does not modify the strict root or delivered license envelope.

Local candidate suite 19/19 PASS at 2234114. Next: guarded rebuild the remaining
four staged roots in new private output directories; checkpoint public inputs
before invocation. Source cache/temporary adapters/toolchain obligations,
ordinary App 1/5, default-build ownership, eight unrebuilt targets, new compiler,
candidate and full dual-model Pi/release remain separate mandatory gates.
Counts remain 10/18 built and 5/18 selected; full release_qualified=false.

## 2026-10-01 whole staged-cohort guarded build closure

Task state: in-progress. The real process portable-v2-source-witness-cohort-r9
terminated successfully. Public input cf26b71c5b9d0d9b121bedfb6499016d42783d18,
clean private producer 3b797a77d0afa25264a11362603b0d596d2e0ba7. HTTP1, Data
Core, Host Clock, Owned Algorithms and Resource Counter each pass both guarded
builds, strict reopen and complete package equality. Separate retained workspace
recheck passes both workspaces for each package. Total 38 input files and 45
delivery files. Existing staged roots, qualification bytes and old immutable
release are unchanged. Receipt: admission/current-v2-next/cohort-build-input-witness.json.

Public receipt validator pins the observed witness hashes and committed public
input/producer authorities independently, checks both reports against existing
qualification receipts, and walks actual complete delivery roots. It explicitly
does not reexecute private source verification. Independent fixture has 27
negative controls, including coordinated self-rehash and actual file/link faults.
These new outer audit records are not yet recipient-envelope delivery evidence.

Current registry-source diagnostic: 189 checksum-verified archives and 12,335
extracted source files compared byte-for-byte, zero mismatches/extra files
except exact .cargo-ok marker. This was a live read-only observation, not a
build-time/cache-stability attestation; no gate is upgraded from that diagnostic.

Next: implement and independently test reusable registry source verification,
capture pre/post cache evidence around actual builds; retain external generated
adapter evidence separately. Bind complete audit records into actual recipient
delivery only with corresponding rejection tests. Resolve private preflight and
ownership before compiler/default/WIT changes. No owner message was authorized
or sent. Generic App, eight unrebuilt packages, full license audit, matching new
compiler/candidate, exact dual-model Pi and formal release remain required.

Local candidate suite 20/20 PASS after this slice; research-only license policy
PASS and git diff --check PASS. CI routing check is named
scripts/test-current-v2-ci-routing.mjs (the guessed test-ci-routing.mjs does not
exist and its MODULE_NOT_FOUND invocation was not a product/route test result).
No exact new hosted all-checks PASS or release promotion is claimed.

## 2026-10-01 reusable registry source and routing guard

Task state: in-progress. New read-only registry witness checks exact locked
archive bytes and every extracted file; unknown entries, additions, missing
files, links, unsafe paths and source/registry/patch/path/env overrides reject.
34 independent negative controls PASS. Actual current cache capture PASS:
189 crates / 12,335 source files. SHA256 aggregate
92d24d209afa0b99e83811d6d45909c513b861f300559a9a8009a275d93f14cd.
Only digests/counts are public; private/compiler/cache source bodies stay private.

Portable runner fourth argument after PACKAGE_ID selects an explicit CARGO_HOME
for the real producer. The runner captures registry/routing metadata pre/post
build and compares both independent passes. Existing no-fourth-argument receipts
are not upgraded; their workspace gates remain valid. Configured wrappers and
temporary generated adapter contents remain separate pending scope. No private
source or Host API changes. Checkpoint guard before actual build invocation so
the public Git input identity is clean. Full license/release flags stay false.
Cargo config admission is exact reviewed non-routing digest (or absence), not
an ad-hoc partial TOML parser; quoted/dotted override controls also reject.
First real registry-guard invocation at b8b4719 failed before output creation:
Git committed dependency inventory exceeded execFileSync default 1 MiB buffer
(ENOBUFS). Fixed both public/private committed-input retrieval with a bounded
64 MiB buffer; independent 2 MiB committed fixture proves exact-byte retrieval.
No cache/build PASS is inferred from the failed invocation.

After the buffer repair was committed/pushed as e64d2ce, actual HTTP1 dual
build portable-v2-registry-witness-http1-r11 PASS. Explicit selected CARGO_HOME,
all 189 conservative dependency archives/extracted source trees and retained
Cargo routing configs pass pre/post stability and independent equality. Both
workspaces and current registry were separately reopened after the build PASS.
All nine files equal the existing staged complete package. Source-free evidence
is admission/current-v2-next/http1-registry-build-witness.json; this is outer
audit metadata, not yet a carried licensed-envelope claim. Full private receipt
is retained in the private output directory, not copied with source bodies.
Local candidate suite 21/21 PASS at e64d2ce. Next run this registry guard on the
other four staged roots (all-cohort selection may use empty PACKAGE_ID followed
by explicit CARGO_HOME), then bind and test the resulting delivery evidence.
Default/complex App ownership and all other release blockers remain unchanged.

## 2026-10-01 nested Cargo configuration guard

Revalidated live authority: fetched origin/master remains
3b797a77d0afa25264a11362603b0d596d2e0ba7. Runtime owner still claims the full
crates/wasmc_core_runtime directory exclusively with started/not-ready task;
WIT worktree still has the ten prior dirty files. No source changes or owner
messages were made. Asked again for human authorization to coordinate owners.

Routing audit now scans retained nested crate configs, not only workspace and
ancestors. Unknown nested source override rejects; exact reviewed config is
recorded. Cargo target output is excluded only at a crate; src/target remains
source. 36 negative controls PASS. Previous real builds keep their exact guard
revision, not a retrospective claim that this newer code was executed.
All earlier captured source input inventories have no nested Cargo config.
Whole-cohort registry build process r12 remains live; do not restart merely
because observation produces no output. Local 13 workspace controls and 2 MiB
committed-input retrieval fixture PASS. All-package release flags remain false.

## 2026-10-01 whole-cohort registry process terminal PASS

The exact live process r12 has now terminated successfully; no restart occurred.
Public input 1e3d3e4ab96704184c9498cc1cb189afa5ace122, producer
3b797a77d0afa25264a11362603b0d596d2e0ba7. All five staged Libs pass registry/routing
pre/post checks and independent equality. Separate post-build live check of both
workspaces for every package and current registry PASS. All 38 retained inputs
and 45 complete delivery files equal prior staged qualified roots. Observed
source metadata: 189 crates / 12,335 files. No nested configs occur in captured
input inventories; do not claim the newly edited nested guard ran during r12.

Source-free compressed audit projection (one shared registry inventory, not ten
repeated copies): admission/current-v2-next/cohort-registry-build-witness.json.
The private full producer receipt remains under target/portable-v2-registry-witness-cohort-r12.
Public validator checks exact source/producer, independent observed registry and
workspace identities, Cargo routing/config profile and actual complete roots;
it does not reexecute private builds/cache checks. Existing fixture now totals
48 negative controls: 27 workspace and 21 registry, including coordinated
self-rehash, per-package flags, routing substitution, actual package faults and
false temporary-adapter/license/newer-guard claims.

The new audit receipts are not yet bound into recipient license delivery. Next
bind them with real recipient deletion/tamper/link/self-rehash controls, then
continue external generated-adapter and target/toolchain obligation review.
All source-owner claims remain active; awaiting human permission to coordinate,
not interpreting an automatic goal continuation as that authorization. Counts
remain 10/18 built, 5/18 selected, ordinary App 1/5; release_qualified=false.
Local candidate suite 21/21 PASS after this slice; 36 registry-source/routing
controls and 48 retained-receipt controls PASS, research license policy and
current-v2 CI routing PASS, git diff --check PASS. No hosted all-checks or new
release qualification is claimed. Live r12 process is terminal, not a wait.

## 2026-10-01 retained build evidence delivered to actual recipients

Task state: in-progress. Added only the two canonical full-cohort audit records
to the outer research-license distribution; historical single-HTTP observations
remain repository evidence, not redundant required recipient files. The two
records are independently validated before binding and reopened from the fresh
recipient alongside all actual complete package roots. No private source,
compiler binary or cache contents are copied; strict roots remain unchanged.

Actual capsule now has 79 files; isolated generated-SDK tree 81 files with
carried Cargo.lock reused byte-for-byte. HTTP1 delivered behavior 1,422 cases
PASS; five-package Wasmtime 49 SDK behavior PASS. 69 recipient negative
controls include missing/mutated/linked records, false scope flags, internally
self-rehashed workspace/registry identities plus forged outer indexes.
Private build/cache reexecution, temporary adapters and full audit are false.
Test cleanup touches only its own exact mkdtemp fixture, not prior deliveries
or shared compatible Cargo build caches. Source ownership coordination remains
awaiting explicit human authority; all 18 targets, 8 unrebuilt targets, ordinary
App 1/5, new matching compiler/candidate and full live Pi/release are unchanged.

Qualification rerun PASS with current oracles and actual 79/81-file recipient
SDK evidence; Wasmi fixtures, Component/Core behaviors and original App scope
remain explicit (intrinsic imported drop callback still not executed). Initial
CI run was started before qualification refresh finished and rejected oracle
drift; the legacy closure SDK count also required updating. It is not a PASS.
Diagnostic logs remain under target/ci/candidate-node-github. After successful
qualification, candidate-licensed-witness-delivery-r2 runs all 21 checks PASS.
SDK counts now derive from the trusted envelope plus the two reviewed public
glue files, not duplicated stale constants across qualification/closure checks.
Two ordered envelope recaptures byte-identical; research license, current-v2
CI routing and git diff --check PASS. No hosted all-checks or release claim.

## 2026-10-01 private source-admission preflight failures

Read-only reorientation at clean detached producer
3b797a77d0afa25264a11362603b0d596d2e0ba7 (equal to observed origin/master)
found additional source-maintenance gates. Existing cached native bootstrap
was used, not rebuilt or claimed as a new checker qualification. No private
source, shared knowledge files, claims or history were changed.

- maintainer-check rejects active-tree audit with status 24.
- knowledge-core rejects global-model-and-coverage with status 407: 683
  current sections versus 681 declared sections. The missing registrations
  are Public Lib boundary minimization rule and Runtime/Developer Agent
  surface rule in wasmc-standard-library-evolution/SKILL.md. Historical
  provenance coverage passes; this is not a full MST or history audit.
- maintainer-disclosure rejects that same Skill at status 701: 510 lines,
  hard limit 500, no exception. A line-only deletion does not resolve the
  separate stable-section coverage failure.
- context-commit rejects the exact producer commit with status 10 and three
  empty observed review-trailer groups. First parent is
  e9841b0a938c26557470884b6d2ee7b39d79df40; kernel SHA256 is
  ae936a41944f5c0556d42c6a0b70413b018875dbb6cdaa811a9ce4d81982be3e.
  This command checks canonical single-commit reviews only: it does not
  evaluate history exceptions, baseline audit or side-parent inheritance.
- knowledge-quality and maintainer-discovery pass their independent checks;
  neither overrides the failures or proves full MST acceptance.

Private loop Skill stops implementation admission when orientation/preflight
fails. Repair must preserve knowledge identity/provenance and route disclosure
coherently, then follow the exact context-history policy rather than rewriting
an immutable commit or inventing a generic waiver. Shared metadata ownership
must be resolved before edits. Runtime exclusive started/not-ready claim and
the WIT worktree's ten dirty files also remain untouched; no authorization to
message their owners has arrived. The global private HANDOFF predates the
latest protocol commit and needs an owner-authorized authority refresh.

These observations change the repair order, not package qualification. The
last committed public candidate suite passed 21/21 at 50e858a. Counts remain
10/18 built, 5/18 selected and ordinary App 1/5; full_transitive_license_audit
and release_qualified remain false. No new release or 100% closure is claimed.

## 2026-10-01 generated adapter input capture foundation

Fetched live private authority remains 3b797a77d0afa25264a11362603b0d596d2e0ba7.
Runtime started/not-ready
exclusive claim and ten dirty WIT files remain unchanged. No owner messages,
private writes or process restarts occurred. Previous turn was progress through
new gate failures, not a verified live-process wait.

Read-only producer inspection clarifies the generated adapter's lifetime: it
is an immediate workspace child .wasmc-rust-adapter-PID-NONCE, removed after
publication. Cargo generates its lock offline before the fixed locked build.
Generated source digest covers only src/lib.rs, not Cargo.toml/lock/mapping.
Added a metadata-only, bounded generated-child snapshot and producer digest
binding primitive with 22 fault controls. Initial fixture failed on macOS
/var versus /private/var alias; fixture now uses a canonical temporary parent,
without relaxing linked-input rejection. Development CI includes this fixture.

This is a capture primitive, not actual Cargo-interposition evidence. Real
producer integration, complete generated-manifest qualification and independent
absolute-path-aware comparison remain next gates; all related release/audit
flags stay false. No source bodies are copied or private code changed.

Local candidate suite now passes 22/22 including the new capture fixture;
current-v2 CI routing and git diff --check PASS. The run was from this edited
worktree, not a hosted check or live two-model Pi regression. Existing package
qualification receipts and immutable release identities remain unchanged.

## 2026-10-01 scoped Cargo observer ready for actual mapped-adapter build

Added optional explicit real-Cargo delegation to the portable runner. The
observer exists only in this pass's private output directory and applies PATH
only to the immutable producer child. Fixed known Cargo invocations execute
against a hash-bound delegate; unknown arguments/workspace paths reject. It
captures generated inputs around offline lock creation and locked builds,
retains failures, and binds source/mapping/delivered-lock identities. No global
wrapper, shared temp monitoring or private source change is involved.

New read-only branch inspection corrects profile applicability: OwnedAlgorithms
uses the temporary mapped adapter, while the other four staged roots use direct
wit-bindgen-component retained source. Their same-named CLI source hash does
not prove they created a temporary crate. Ten observer fault controls and the
existing 22 snapshot controls PASS with fixture delegates. Actual selected
OwnedAlgorithms dual build is next; do not claim it from fixture results.
Generated Cargo.toml qualification and independent absolute-path comparison,
full toolchain/target/wrapper obligations and all-package release remain false.

Initial candidate run rejected the builder dirty-input fixture because newly
static-imported optional observer modules were absent from that minimal fixture;
this is a real regression, not a candidate PASS. Observer modules now load only
after clean public/producer checks and only on opt-in. The actual original dirty
input rejection, all 13 retained-workspace controls and ten observer controls
PASS after repair; diagnostics remain under target/ci/candidate-node-github.

## 2026-10-01 actual mapped-adapter dual build terminal PASS

Committed repair c0ac1e389b7f38d9a875fcb1cdda7ecf0200c150 supplied the public
input for target/portable-v2-adapter-observed-owned-r13 in the exact clean
producer. The one actual process completed successfully, not a pending wait.
OwnedAlgorithms 0.1.0 Core 19,554 bytes and Component 19,902 bytes match the
existing staged roots; both full nine-file inventories are byte-identical and
strictly reopened. Each pass observes offline lock creation and fixed locked
build before adapter deletion. All four generated input files remain stable
during build; source/mapping/lock bind to independent producer and delivered
lock identities and match across passes. Separate post-build retained-workspace
and selected registry/routing rechecks PASS.

Source-free observation is owned-generated-adapter-observation.json under the
current-v2-next admission directory. Exact private receipt stays private. Two
Cargo.toml hashes differ: this record does not qualify their manifests or prove
absolute paths are the only difference. Independent manifest qualification,
licensed delivery of this new record, wrapper/toolchain/target obligations and
full release remain false. Other four staged packages use the direct profile;
do not pretend this adapter result executes their distinct builds or all 18.
Local repaired candidate suite candidate-cargo-observer-fixed is 22/22 PASS at
c0ac1e3, with ten separate Cargo-observer controls PASS. Source ownership and
private MST blockers remain untouched; all-package counts still 10/18 built,
5/18 selected, ordinary App 1/5. No live model pair or new release is claimed.

## 2026-10-01 generated manifest qualification ready for new real execution

Added complete finite manifest profile audit from independently selected build
specification, with exact local dependency binding and realpath checks. No
unknown/duplicate Cargo fields/sections, feature/patch/build-script additions or
dependency substitution is allowed. Only one verified path literal is scrubbed;
the independent comparison retains all other bytes, not just parsed semantics.
Observer hashes the selected auditor and verifies profile before/after Cargo;
runner requires profile and semantic/non-path byte equality across passes.
Twenty-four profile negatives and twelve delegate controls PASS, including
pre-delegation manifest rejection. Development CI adds this fixture. Existing
r13 record is unchanged and cannot inherit this new gate retroactively. Next
run the new gate in an independent OwnedAlgorithms dual build; all obligations,
source-owner/MST blockers and all 18-package release scope remain unchanged.

## 2026-10-01 finite generated-manifest gate actual dual-build PASS

Fetched private origin/master still equals clean producer
3b797a77d0afa25264a11362603b0d596d2e0ba7. Committed/pushed public input
7f4cdf577f4e99032a901f73df5170061ef3902d executed the new full manifest gate in
target/portable-v2-adapter-manifest-qualified-owned-r14. The actual process is
terminal PASS. Both OwnedAlgorithms 0.1.0 builds pass generated profile audits
before/after Cargo; semantic models and all bytes outside the one exact verified
dependency path literal match across independent passes. The complete nine-file
output remains byte-identical to the staged package and passes strict reopen.

Post-build live retained-workspace and selected registry/routing checks PASS;
source-free metadata records compiler-selected specification equality, source/
mapping/lock binding and exact committed observer/auditor source hashes. New
owned-generated-manifest-qualification.json records this result independently.
Original r13 observation still reprojects byte-for-byte and is not upgraded.
Local development candidate suite is now 23/23 PASS; 24 profile negatives and
12 delegate controls PASS. The suite ran before this observation-document
commit, not a hosted or live-model qualification. No private source bodies or
strict Lib roots changed. New-record licensed delivery, complete obligations,
source-owner/MST blockers and all-package counts remain unchanged; no release.

## 2026-10-01 generated-manifest witness licensed delivery

Added independent exact-observation validator for the r14 manifest witness and
actual nine-file package reopening. Fifteen negative controls PASS, including
internally rehashed input metadata and real missing/linked/altered package files.
The outer licensed distribution now binds and carries that one additional
record; its original licensed_recipient_delivery=false describes capture time
and is not rewritten to claim its own later delivery. The carrying envelope
reports delivery separately, preserving acyclic binding and scoped coverage.

Actual fresh capsule has 80 files; source-free generated-SDK tree 82 files,
with carried Cargo.lock reused byte-for-byte. All 78 recipient controls PASS,
including generated-record deletion/tampering/links and coordinated semantic
digest/record/index self-rehash. HTTP1 1,422 cases and five-package Wasmtime 49
SDK execution PASS. New fields explicitly cover one mapped package, two builds
and four generated input files; no all-five adapter or full audit claim.
Qualification refresh session 81729 completed successfully, including actual
Wasmi fixture execution and licensed SDK use; no restart occurred. Imported
resource-drop callback remains explicitly unexecuted, not a newly closed gate.
All 18 targets, 8 unrebuilt targets, ordinary App 1/5, private MST/owner blockers,
matching new compiler/candidate and full live model/release gates remain open.

Two ordered licensed-envelope recaptures are byte-identical. Local candidate
suite candidate-generated-witness-delivery passes 24/24 after qualification
refresh, with CI routing and git diff --check PASS. This is edited-worktree
evidence, not hosted CI, a frozen new candidate, live Pi pair or release.
