# Lib v2 CI closure

Task state: in-progress

Objective: validate current v2 discovery and package bytes independently from
the immutable v0.0.20 release, retaining rejection of future product drift.

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

Resume: review hosted CI on this branch/PR, then integrate serially. WIT
dependency support and thirteen package rebuilds remain separate unfinished
work. Pi live two-model runs and a new release have not been performed.
