# Host → Lib graduation flywheel

The Host is an external-effect substrate, not the place where reusable software
logic accumulates.

## Architecture

```text
fixed domain-neutral Host boundary
        ↓
platform system Lib + native descriptor
        ↓
portable system Lib
        ↓
higher-level Libs
        ↓
App / Agent
```

The portability target is simple: the higher a layer is, the less it should
know about Host/provider/platform identity.

## Graduation test

For every Host-backed workload, classify each responsibility:

1. **Irreducible mechanism** — fixed target/resource/window/operation/completion
   machinery stays Host-side.
2. **Physical binding** — a platform system Lib owns the native descriptor and
   converts physical calls into typed Lib semantics.
3. **Portable semantics** — protocol, parser, codec, transformation, policy,
   state machine or algorithm; graduate to a Lib.
4. **Application policy** — remains App-specific unless reusable enough to be a
   separate Lib.

Host identity must not leak upward merely because one implementation started in
a Host qualification fixture.

## Flywheel

```text
real Host workload
  → isolate irreducible effect
  → define WIT
  → public clean-room Lib source
  → behavior/negative tests
  → engine portability qualification
  → admission as exact Lib version
  → catalog + LibSearch
  → Agent/library-first use
  → missing mechanism feedback
  → next Lib or independently justified boundary revision
```

Existing frozen qualification artifacts may be used as behavior oracles. They
are not public source authority and must not be decompiled into a claim of
original source provenance.

## First graduation cohort

- router policy — import-free; first public-source graduation sample; clean-room
  source and behavior-equivalence gate implemented.
- JSON document — import-free; public Rust source implemented with exact WIT
  contract and representative Component-level oracle equivalence. Resource
  boundary calibration and multi-engine admission remain pending.
- gzip compression — import-free; public Rust source implemented with exact WIT
  contract, representative behavior equivalence and deterministic gzip byte
  equivalence. Resource boundary calibration and multi-engine admission remain
  pending.
- HTTP/1 wire — import-free; public Rust source implemented with exact WIT
  contract and representative request parsing, framing and response
  serialization equivalence. Resource boundary calibration and broader
  protocol coverage remain pending.
- TLS core — protocol/state-machine logic is now a public-source candidate with
  exactly one semantic Host import, `entropy.fill`. Network transport stays
  outside the Lib. The current server profile needs no Host clock; future
  time-dependent TLS features must justify that capability separately.

The cohort is incubation evidence, not an admitted package list.
