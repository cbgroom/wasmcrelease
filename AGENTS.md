# WAsmC public Agent entrypoint

Unreleased guidance workstream. Runtime artifacts are frozen inside the v0.0.21
product set; product presence is not lifecycle authority. Start with
`agent-quickstart.json`, a small route index. Choose the matching intent and run
its `read_command` to read and verify only the selected route, then its
`required_additional_reads`. Run its named checks and stop. Route integrity is
verified by that command; no manual route hashing or digest report is needed.
Copy required identities completely; never use
an ellipsis or placeholder. A field name alone is not a requested identity.
Report only requested identities; leave other verified digests in machine receipts.
Choose the route by the requested output: release/version/entrypoint/compiler
integrity uses release-orientation; import permissions use host-authority-boundary;
writing or editing source uses source-adaptation. These are separate intents.
Read licensing authority only for permission or licensing questions.
Functions have one semantic result. Preserve multiple requested values with
one tuple or record; combining them into a boolean loses the separate values.

For release orientation use `agent-release-orientation.json`; open the full artifact inventory
in `manifest.json` only if the compact check fails. `release.json` and
`channels/prod.json` decide the published product. Construct CDN URLs only after reading the exact tag from `release.json`.
Pin that tag or a full public commit; mutable main is discovery.
Private source commits identify compiler source, not public release commits.

## v0.0.21 product capability contract

For an unfamiliar task follow the general route, then the selected public Skill:
- Source: [developer Skill](skills/wasmc-developer/SKILL.md) and `LANGUAGE.md`.
- Reusable computation: [Library-first discovery](skills/wasmc-lib-discovery/SKILL.md); search is discovery, not approval.
- SDK/embedding: [SDK discovery](skills/wasmc-sdk-discovery/SKILL.md).
- Standard roots: `standard/wasmc-std/1.4.1/`, `standard/wasmc-lib-search/0.5.0/`.
- State transitions: `docs/AGENT_DECISION_MODEL.md`. Qualification is evidence, not admission.

Before instantiation inspect every import and compare module/name/kind/signature
against an application-owned exact allowlist. Imports request effects and grant
no ambient authority. Pure execution requires `imports=[]` and `{}`.
For permission questions read `license-policy.json` and `LICENSE`; commercial and production
use require a separate written license. Compiler implementation source is private.
