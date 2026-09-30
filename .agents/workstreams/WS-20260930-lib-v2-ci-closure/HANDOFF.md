# Lib v2 CI closure

Task state: started

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

Resume: implement the current development suite and execute it locally before
publishing an implementation checkpoint. No new release identity is allocated.
