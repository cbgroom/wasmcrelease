# Declared third-party notice policy

Task state: completed — bounded policy repair; integration ready
Base: 83c9511be282c36f3dc3789517dc4a4995e0d493
Objective: Permit verbatim third-party notice bundles only after reviewed catalog
identity, manifest and every license file are verified; retain first-party grant
checks and reject undeclared files, substitutions, paths, links and changed data.
Result: collector requires a separately reviewed thirdparty_notice_catalog_sha256
in current-v2 policy before any exemption; then verifies selected manifest and
all snapshot bytes, research-only root LICENSE, file bounds and unique paths.
Only exact declared dependency-notice bundles are exempt from first-party grant
scanning. Read-time link/type/drift checks reject linked inputs. Legacy omission
grants zero exemptions. No catalog digest is inferred or updated automatically.
Boundaries: old roots, tags, prod, global identity and binaries unchanged; no legal,
notice completeness, runtime, SDK or release qualification claim.
Validation: unit positive plus15 negative controls PASS. Actual full policy on
three previously qualified private roots admits13 exact notice files. Four
actual mutations (notice drift, undeclared notice, linked notice, missing policy
digest) reject; restored packages pass. Existing policy, all18 guard and historical
candidate routes pass; old0.0.20 rejects product drift. Original full maintainer
lib-catalog identity failure remains NOT PASS; no frozen identity refresh.
Raw private qualification SHA256
4cf6fd0f9d972051742d3b9ebb56b89f67a6fc21882e2bfcda138d4d82498faa
binds exact pushed source3baecbc970f16ff4a32a788ff8863add1287243d,
including the final unit-test source. This later checkpoint changes state only.
Resume: recheck clean pushed source, integrate serially, then explicitly bind a
reviewed future catalog/policy and dependencies into the new candidate inventory.
Actual all18 fresh builds, notices/compatibility, ordinary App, Pi and release
remain incomplete. No private package or source was imported publicly.
