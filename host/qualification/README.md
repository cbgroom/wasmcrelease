# Host qualification

Public evidence distinguishes provider binding state from evidence grade.

## Provider binding state

The platform manifests under `host/platform/*/providers.json` are the support
claim authority:

- `unimplemented`: no canonical provider implementation is claimed;
- `implemented`: canonical provider code exists, but platform qualification
  is incomplete;
- `qualified`: implementation, qualification workflow and architecture scope
  are all present.

Every platform declares every canonical capability explicitly. Missing entries
are validation failures, not implicit unsupported states.

## Evidence grade

Evidence can independently be described as:

- `simulated`: structural/simulated evidence only;
- `qualified`: the declared qualification matrix passed;
- `production-qualified`: stronger production/device evidence exists.

Evidence grade must never upgrade a provider binding state by itself.

Resource locality is a separate Host-private dimension. "Remote" is not a
provider binding capability; remote providers are qualified against the same
semantic capability as their local counterparts.

## Qualification dimensions

Native and JS-runtime qualification is recorded as physical platform × embedding when both dimensions are meaningful. Browser engine qualification is embedding-only; Browser is not treated as an operating-system platform.

See `matrix.json`.

Run `node scripts/report-host-support.mjs --markdown` for the current
platform × capability support matrix. The report is derived from provider
manifests and is not a second source of authority.
