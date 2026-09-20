# Host → Lib graduation flywheel

The Host is an external-effect substrate, not the place where reusable software
logic accumulates.

## Architecture

```text
irreducible external effect
        ↓
Host Capability / Resource / Operation / Completion / Window
        ↓  thin binding
portable Lib
        ↓
higher-level Libs
        ↓
App / Agent
```

The portability target is simple: the higher a layer is, the less it should
know about Host/provider/platform identity.

## Graduation test

For every Host-backed workload, classify each responsibility:

1. **Irreducible effect** — requires OS/device/remote authority; stays Host.
2. **Thin adaptation** — converts the effect into a portable resource/byte/event
   shape; keep minimal and capability-scoped.
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
  → missing capability feedback
  → next Lib or justified Host primitive
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
- gzip compression — import-free; public reimplementation required.
- HTTP/1 wire — import-free; public reimplementation required.
- TLS core — one entropy dependency today; graduate protocol/state-machine logic
  while keeping entropy/TCP/time authority thin and explicit.

The cohort is incubation evidence, not an admitted package list.
