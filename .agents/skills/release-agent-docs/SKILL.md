---
name: release-agent-docs
description: Create or revise WAsmC public Agent guidance, language documentation, capability matrices, and examples so a zero-context model can use only shipped public features.
---

# Release Agent documentation

## Outcome

A fresh Agent should answer, in its first screen: which release is current,
which task path applies, what source it can write now, what is unavailable,
which exact command proves the path, and what evidence to report.

## Writing model

- Reuse Rust expression/control-flow vocabulary and WIT declaration/type
  vocabulary when semantics align; document only the WAsmC delta.
- Put one canonical current-capability matrix near the public entrypoint. Route
  detail to `LANGUAGE.md` and executable examples instead of duplicating it.
- Separate `shipped`, `prebuilt-only`, `planned`, and `unsupported`. Never infer
  public support from private source, metadata, or provider exports alone.
- Teach a complete copy-run-change loop before catalogs or architecture.
- Every canonical source pattern must compile in the current public artifact or
  be explicitly marked non-executable. Prefer examples exercised by a runner.
- Error guidance should repair the smallest construct and must not invent Host
  authority or provider-private operations.

## FastAPI boundary

The presence of `fastapi_core.wasm` proves a provider is shipped, not that an
Agent can compile arbitrary managed source. For each release, inspect the
facade exports and executable journey. Until a public managed-source entrypoint
and full link/init example both pass, state the managed path as unavailable for
new source and do not teach activation plans, raw handles, or private lifecycle calls.

## Completion gate

Run the published teaching corpus and the maintainer validator. Then perform a
zero-context read from `AGENTS.md`: no private-repository knowledge may be
needed to choose and execute the supported path.
