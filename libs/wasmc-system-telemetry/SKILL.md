---
name: wasmc-system-telemetry
description: "Use bounded system telemetry parsing/cadence through the admitted Component and public Rust Host SDK surfaces."
metadata:
  wasmc:
    version: "0.0.1"
---

# System telemetry Lib

Read `lib.wit` and `references/agent-delta.json` first.

Supported in this package:

- source-free Rust Component consumption;
- public `wasmc-host` SDK integration with explicit generic resources;
- real Linux acquisition from explicitly granted read-only proc resources.

The Lib itself has no filesystem, process, clock, network or telemetry-specific
Host authority. The caller supplies bounded complete snapshots and monotonic
time. Frame encoding is v3.

Do **not** generate direct WAsmC sampler-resource source for this version.
The current public compiler route does not qualify the sampler method's rich
`frame` result. Browser, Wasmi Component execution, and real Windows/macOS
system acquisition are outside the admitted surface.

Never expose raw resource handles or replace the generic Host boundary with a
telemetry-specific callback.
