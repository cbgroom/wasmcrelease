# WAsmC v0.0.20 scope

v0.0.20 is the first WAsmC product governed by the WAsmC Research-Only
Non-Commercial License 1.0. It is source-available for non-commercial research,
education, evaluation, reproducibility and benchmarking. Commercial use,
production operation, paid services and commercial product or R&D use require a
separate written license. It is not an open-source release.

The license boundary is revision-specific. Immutable v0.0.19 and earlier tags,
published packages and artifacts retain the licenses accompanying those exact
identities. v0.0.20 neither rewrites nor revokes an earlier grant. Read
`license-policy.json` and the `LICENSE` from the exact revision being used.

## Product identity

This release deliberately reuses the exact v0.0.19 compiler and Lib artifact
bytes. It adds no compiler, WIT, Lib API, Host API, dynamic Client/Gateway or
runtime behavior. Ordinary-source `u64`, the 22-package / 140-API LibSearch
closure, Data Foundation v1.1 packages, MCPGit resident memory, portable
protocol Libs and the incubating Client/Gateway surface retain their v0.0.19
behavior and evidence boundaries.

The v0.0.20 candidate includes the license text and machine-readable policy as
hash-bound product files. Every Cargo manifest included in this new product is
bound to that license file. Older TCP/UDP package manifests that are not part of
the candidate retain their previously published metadata and are not silently
relicensed.

## Nonclaims

v0.0.20 does not claim:

- revocation or narrowing of any earlier immutable license grant;
- open-source status;
- permission for production or commercial use;
- new compiler, Lib, Host, SDK or Client/Gateway functionality;
- a stable 1.x compatibility promise; or
- publication of private compiler source.

Use `release.json` and the channel files to determine lifecycle state. Product
presence in a candidate is not evidence that dev, main or prod publication has
completed.
