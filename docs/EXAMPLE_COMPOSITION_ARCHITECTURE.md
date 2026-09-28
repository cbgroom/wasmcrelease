# Example composition architecture

Status: active architecture workstream; not admitted or released.

WAsmC uses a two-level example model. Neither one-example-per-Lib nor one
repository-wide mega example is sufficient by itself.

## Level 1: Lib-owned qualification examples

An exact Lib package owns small examples below `libsrc/<package>/examples/`.
They establish the package's public semantics, physical binding and negative
controls without requiring unrelated Libs. They may be built independently and
remain the authority for that Lib's qualification receipt.

These examples must not copy provider source. They consume source declared by
the package's exact platform binding descriptor.

## Level 2: platform integration labs

`examples/system-agent-lab/platform/<os>/` owns one application shell per
platform. A composition manifest selects exact qualified Lib candidates and
combines their provider sources, frameworks and App requirements. The shell is
application composition, not a new provider and not Host authority.

The iOS lab composes real WKWebView semantic control with live network path
observation. Both providers are registered once through the unchanged fixed
Host, run concurrently, and retain independent identities and state. The
Android lab composes display, semantic UI, shell input and direct uinput through
the exact resolved Library OS profile and reuses its Emulator qualification
instead of copying a second harness.

Both platforms use `scripts/system-agent-lab-composition.mjs` for identity,
target, lifecycle, App configuration and exclusive-resource conflict rules.
Platform validators add only physical-artifact checks that cannot be shared.

## Conflict rules

A composition fails before project generation when any of these collide:

- scenario ID, provider identity or WIT API identity;
- an App configuration key has unequal values;
- an exclusive resource has more than one owner;
- a selected source or framework is absent from the exact binding descriptor;
- target tuple, boundary, lifecycle or candidate identity does not match.

Additive sets such as frameworks and background modes are deduplicated in
stable lexical order. A platform shell never resolves semantic conflicts by
load order.

## Ownership

```text
Lib package
  WIT + binding + provider source + focused qualification example
       |
       v exact manifest selection
platform integration lab
  shared App shell + composition test + merged App requirements
       |
       v registrations
unchanged fixed Host
```

Provider packages never import the integration lab. The integration lab may
depend on many providers, but each dependency is exact and machine-validated.
When a reusable UI or test helper has stable semantics of its own, graduate it
to a separate helper package instead of copying it between Lib examples.
