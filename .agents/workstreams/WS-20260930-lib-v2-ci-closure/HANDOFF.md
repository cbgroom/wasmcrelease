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
development suite 9/9 PASS; CI reporting and tag/branch routing controls PASS.
Default current API search previously returned no hit for base64 decode; it now
returns the exact typed API. Old v0.0.20 candidate still rejects future bytes.

Resume: review hosted CI on this branch/PR, then integrate serially. WIT
dependency support and thirteen package rebuilds remain separate unfinished
work. Pi live two-model runs and a new release have not been performed.
