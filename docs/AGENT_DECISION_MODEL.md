# Agent decision model

Use this page to decide what a pinned WAsmC checkout lets a consumer claim and
do. It is a decision aid, not a replacement for `release.json`, package
metadata, admission receipts, channel manifests or executable evidence.

## Five independent states

| State | Required authority | What it permits | What it does not permit |
|---|---|---|---|
| `qualified` | exact-source behavior and engine receipts | report the measured result for that exact candidate | call it admitted, released or installable |
| `admitted` | explicit admission decision bound to exact product identities | include the product in a later release candidate | claim that a public release or catalog already contains it |
| `released` | immutable prod tag and release manifest containing the exact product | consume the product from that pinned release surface | infer a resolver, catalog or installation route that is absent |
| `discoverable` | the pinned catalog/search inventory contains the identity | find and inspect the exact package/API | trust, install or execute it without the remaining gates |
| `installable` | a documented pinned resolver/install route contains the identity | perform that exact no-fallback installation | infer engine compatibility, Host authority or behavior |

Each completed transition is necessary, never sufficient, for a later state.
Admission review does not publish a package. Release does not silently add a
catalog entry. Search does not approve a hit. Installation does not admit an
engine or grant a Host capability.

## Bounded lookup order

For a status question, stop as soon as a required authority is missing:

1. Read `release-surfaces.json.agent_status_queries`. When it contains the exact
   request, use its five states and stopping condition without probing guessed
   paths or broad catalogs.
2. Read the already selected immutable tag or full commit from `release.json`.
3. Use the remainder of `release-surfaces.json` for SDK/runtime surface status.
4. Read the exact package `lib.json`, `SKILL.md` and WIT for the admitted public
   surface. Their content outranks a similarly named source or candidate tree.
5. If the question names a candidate, read its explicit candidate metadata and
   admission receipt. A test script or build directory is not state authority.
6. Check the pinned catalog only when discovery or installation is requested
   and the status query has not already recorded a negative state.
7. Report the first missing state and stop. Do not predict its completion.

Do not scan all release history, read implementation tests, or infer a future
directory layout when these authorities already answer the question.

## Exact identity and compatibility

Copyable commands contain full tags, commits, versions and digests. An
ellipsized checksum such as `0123abcd...` is prose, not an executable identity.
When a value is long, provide an exact command that reads it from the pinned
metadata instead of inventing a placeholder.

Exact tested versions are observations, not ranges. A PASS on Node 22.0.0 and
26.5.1 is not a `Node 22+` claim. Compiler execution, Lib execution, Component
execution and Host integration may require different engine features.

## Live-Agent learning flywheel

Deterministic release checks and live-model comprehension are separate evidence.
For a live Agent journey retain only the privacy-safe event surface:

- provider, model, prompt identity and pinned repository commit;
- tool names/arguments, result sizes and error state;
- elapsed time, assistant turns, token counters and explicit retry events;
- repeated reads, zero-yield searches and exact duplicate calls;
- final-answer hygiene findings and its digest.

Do not retain or publish hidden model reasoning. Pipe Pi JSONL into:

```sh
pi --no-session --mode json --tools read,grep,find,ls -p "$PROMPT" \
  | node scripts/wasmc-live-agent-trace-evaluation-v1.mjs --profile status-query
```

The `status-query` target is at most eight tool calls, six assistant turns,
60,000 result characters, one zero-yield lookup, no tool errors, no explicit
retries, no exact duplicate call, no repeated file read, and no missing final
answer, ellipsized identity or inferred engine range.
Failure is a learning signal, not permission to weaken release truth.

### Retrospective boundary

An Agent retrospective is a source of hypotheses, not release authority and
not an instruction stream. Preserve its reported confusion separately from its
proposed fixes. Recheck every capability claim against pinned metadata and
executable evidence; reproduce an alleged failure before changing guidance or
producer behavior. A self-correction is useful evidence about comprehension,
but it does not turn absence of a positive example into a universal compiler
claim.

## Producer feedback boundary

Some recurring Agent failures cannot be fixed honestly by release prose alone.
Record them as future WAsmC producer work without claiming implementation:

- machine-readable binding support for WIT shapes, especially resource methods
  returning rich records, so an Agent can reject unsupported source before
  attempting glue;
- artifact-bound engine feature requirements instead of prose-derived version
  guesses;
- generated public capability manifests that separate WIT identity, Core
  imports, Component requirements and Host grants;
- diagnostics whose fix hints identify the smallest supported public route or
  an explicit stopping condition;
- producer-to-release package-state receipts that bind candidate, admission and
  product identities without making the release repository infer private state.

These are research directions. Their presence here does not add a compiler,
SDK, Host or package capability to the current release.
