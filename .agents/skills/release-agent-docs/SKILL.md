---
name: release-agent-docs
description: Create or revise wasmc public Agent guidance, language documentation, capability matrices, and examples so a zero-context model can use only shipped public features.
---

# Release Agent documentation

## Outcome

A fresh Agent should answer, in its first screen: which release is current,
which task path applies, what source it can write now, what is unavailable,
which exact command proves the path, and what evidence to report.

## Writing model

- Published repository instructions and the Release page must be self-contained:
  entrypoints, immutable selection, verification, commands, evidence and limits
  cannot depend on supplementary chat caveats. Keep README as the canonical
  complete handoff and link detailed evidence rather than duplicating claims.

- Reuse Rust expression/control-flow vocabulary and WIT declaration/type
  vocabulary when semantics align; document only the WAsmC delta.
- Put one canonical current-capability matrix near the public entrypoint. Route
  detail to `LANGUAGE.md` and executable examples instead of duplicating it.
- Separate `shipped`, `prebuilt-only`, `planned`, and `unsupported`. Never infer
  public support from private source, metadata, or provider exports alone.
- Teach a complete copy-run-change loop before catalogs or architecture.
- Every canonical source pattern must compile in the current public artifact or
  be explicitly marked non-executable. Prefer examples exercised by a runner.
- Executable commands must contain complete identities. Never put truncated
  digests, ellipses, placeholders or inferred version ranges in a copyable code
  block. If the user must obtain a value dynamically, teach the exact command
  that reads it from the pinned authority.
- Error guidance should repair the smallest construct and must not invent Host
  authority or provider-private operations.

## Decision and learning trace

Teach `qualified`, `admitted`, `released`, `discoverable` and `installable` as
separate states. A completed transition is necessary evidence for the next; it
never completes the next transition automatically. Route public readers through
`docs/AGENT_DECISION_MODEL.md` and require the first missing authority to be a
stopping condition.

Final-answer correctness is only one half of Fresh-Agent quality. For a live
Agent journey retain a privacy-safe event trace containing tool names and
arguments, result size/error state, model/provider identity, token counts,
elapsed time and the final answer. Do not retain or publish hidden reasoning.
Score wrong routes, zero-yield searches, repeated reads, oversized reads,
failed tools, retries, conclusion changes and identity placeholders separately.
Use `scripts/wasmc-live-agent-trace-evaluation-v1.mjs` for the Pi JSONL adapter.
Deterministic artifact evaluation and live-model comprehension are distinct
scores; neither may be presented as the other.

## Lib boundary

Route reusable computation through Library-first discovery before source
generation. Teach package/API hit interpretation, exact selection and a real
execution oracle separately. Preserve frozen package Skills; strengthen their
public discovery route without rewriting an admitted product inventory.
Run `node scripts/test-library-first.mjs` to exercise teaching commands against
the actual embedded index and reject missing routes or escaping target paths.

A managed-source claim requires both `compileLib`/`instantiateLib` and an
executable link/init/invoke journey using the matching release Lib. Teach only
ordinary typed source and reviewed WIT; do not expose activation plans, raw
handles, Store nonces, private lanes, or lifecycle helpers. Each standalone
Lib begins at its root `SKILL.md` and states its exact delta and Host authority.

## Completion gate

Run the published teaching corpus and the maintainer validator. Then perform a
zero-context read from `AGENTS.md`: no private-repository knowledge may be
needed to choose and execute the supported path.
