# Dependency compilation cache, not acceptance

Desktop Host workflows cache only their explicit Cargo target directories.
Keys separate workflow, OS image, architecture, fixed Rust1.96.0 and all relevant
Cargo manifests/locks. No broad restore prefix crosses toolchain/lock/platform
identities. Actions cache is pinned to a reviewed upstream commit; branch cache
scope follows Actions' default-branch/branch rules.

Every job unconditionally cleans only our named Host packages from these target
directories before building. This includes path dependencies in the App target,
and the independent file/completion targets. Our source is rebuilt even if the
cache key matches; Cargo may reuse locked upstream dependencies. No test,
Clippy, full-module validation, engine profile or integrity gate is skipped on
cache-hit. Cache state is never source/release authority or portable Wasm output.

Mobile cross-check and browser jobs remain independent. This does not solve
runner scheduling or guarantee faster jobs; measure cold/warm real runs before
claiming speedup. Build cache artifacts do not become release artifacts.
