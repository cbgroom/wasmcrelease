# dev → main → prod promotion

This is the accepted policy for future releases. It does not change existing
immutable tags, and does not mean a new version has already been published.

| Stage | Immutable identity example | Admission | Discovery |
|---|---|---|---|
| dev | `v0.0.12-dev.2` | exact-source build, integrity, focused behavior | dev only |
| main | `v0.0.12-main.1` | same product digests, complete consumer CI and guidance | main candidate only |
| prod | `v0.0.12` | same product digests, retained exact-candidate qualification and publisher promotion | release pointer |

`main` in a tag suffix is an acceptance stage, not the mutable Git branch `main`.
`prod` has no suffix. For 0.0.x, prod still has `stable=false`; deployment stage
must not be confused with the semantic compatibility promise of stable1.x.
Only prod advances `package-index.json.latest` and the default release pointer.
dev/main must remain GitHub prereleases and cannot silently replace prod.

A candidate manifest binds the exact private source authority, toolchain, input
inventory and product file digests. Promotion reuses these product bytes rather
than rebuilding. Stage metadata and evidence can differ and have their own
immutable commit/digest. Any product change starts a new dev candidate; a failed
gate cannot be relabeled main/prod. No force-push or tag movement is allowed.

Consumer workflows execute immutable public files, never rebuild canonical
compiler or Lib products. Qualification must include the specific new Lib and
its actual API, WAsmC/Rust equivalence, portable engine acceptance, lifecycle,
negative cases and complete source-bound reports. A probe or feature flag alone
cannot qualify a production Lib. Performance is observational unless a measured
contract explicitly promotes a threshold.

Release surfaces are defined by `release-surfaces.json`. Published and candidate
surfaces must have named functional workflows; architecture/incubating surfaces
must not be promoted by documentation alone. Desktop native products retain
Linux/macOS/Windows x86-64/arm64 qualification cells where GitHub runner support exists, but release gating requires five current targets; macOS x86-64 is legacy optional and must not block promotion.

Performance baselines are platform-relative. A Linux x86-64 timing is compared
only with Linux x86-64 history, Windows arm64 only with Windows arm64 history,
and so on. Cross-platform absolute timing equality is never a promotion gate.

Rollback changes only mutable discovery to a previously qualified prod identity;
it never alters an immutable artifact/tag or makes prerelease bytes default.
