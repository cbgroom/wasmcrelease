# Zero-new-Host-API telemetry qualification

## Decision

The first qualification does **not** justify a new Host API.

System telemetry can be modeled as provider/resource semantics behind the
existing Host mechanisms: describe/open/read/wait/cancel/release/window. The
high-frequency data path benefits materially from batching into an existing
Window. No telemetry-specific syscall is required by the evidence below.

This is not a claim that the complete direct WAsmC resource binding is already
published. The released source/compiler path still needs the generic WIT
resource binding/lowering closed before ordinary WAsmC source can itself own an
endpoint/window and directly pull telemetry. That is a generic binding gap, not
a reason to add CPU/memory/network Host operations.

## Authority and invariant

- Base: origin/main at f81b598f11198e0d801ec21dd95d585ff495953b
  (v0.0.11 production/main baseline).
- Development node: youdeMac-mini.local, Darwin arm64.
- Linux cross-platform node: huawei-ThinkCentre-M920t, Linux x86_64.
- host/contract/v0/host.wit was not modified.
- Experiment selector system/telemetry is local test policy, not a published
  namespace or Host syscall.
- Hot frame size: fixed 64 bytes; bounded ring; binary encoding; no JSON in the
  resident path.

## macOS arm64

Resident cross-platform sampler, sysinfo 0.39.6:

- 2,000 snapshots in 1,032.641 ms.
- 516,320 ns/sample, about 1,936.8 samples/s.
- sysinfo reports a 200 ms minimum CPU-usage update interval, so a faster sample
  cadence does not imply fresher CPU utilization values.

Shell comparison:

- 40 runs of sh -> ps took 1,761.704 ms.
- 44.043 ms/run, about 22.7 samples/s.
- This is roughly 85.3x slower than the resident sysinfo sampling loop on this
  host. It is a fork/exec/text-path comparison, not a semantic-equivalence
  claim.

Existing-semantics stream:

- synthetic 1 kHz, batch=1: 1199 produced / 1199 consumed, zero ring drop and
  zero sequence gap in the first run; the exact-source rerun produced
  1201/1201 with zero drop/gap.
- synthetic 1 kHz, batch=32: 1200/1200, zero drop/gap, 0.031667
  read/wait calls per frame.
- sysinfo requested at 1 kHz, batch=32: 1198/1198, zero drop/gap,
  0.031720 calls per frame. CPU values remain subject to sysinfo's 200 ms
  CPU-usage update interval.

In-memory transport isolation with 100,000 pre-produced frames:

- batch=1: 10.24M frames/s.
- batch=32: 100.04M frames/s, 0.031270 Host-semantic calls/frame.
- batch=256: 129.97M frames/s, 0.003930 calls/frame.

These numbers isolate experiment-local copy/ring/Window semantics; they are not
the production physical Host transport benchmark.

## Existing physical Host transport

No telemetry transport was invented. The repository's existing HTTPS
qualification implementation was run directly:

- HostEndpoint + HostWindow + HostOperation.
- shared reactor candidate.
- read/write + wait + take_result.
- 1 connection, 5,000 echo iterations, 64-byte frame.
- 10,000 physical Host operations/transfers.
- 226.779 ms measured workload time.
- 44,095.858 logical transfers/s.
- pending peak=1.

This workload is stricter than a one-way telemetry batch because each iteration
does both a Host write and a Host read. It demonstrates that the already
existing physical Endpoint/Window/Operation machinery has ample per-node
headroom for a 1 kHz-class telemetry stream on this machine. It does not claim
100,000 simultaneous gateway connections have been qualified.

## Linux x86_64

The exact same Rust source and Cargo.lock were copied byte-for-byte to the
Linux node. The machine was already heavily loaded during the run, so absolute
provider rates are intentionally not treated as stable capacity numbers.

Transport isolation:

- synthetic 1 kHz, batch=1: 1201/1201, zero drop/gap.
- synthetic 1 kHz, batch=32: 1201/1201, zero drop/gap, 0.031640
  calls/frame.
- 100,000-frame microbenchmark:
  - batch=1: 18.04M frames/s.
  - batch=32: 69.93M frames/s.
  - batch=256: 101.83M frames/s.

Provider limitation under load:

- sysinfo sampler: 2.666 ms/sample, about 375.0 samples/s.
- requested 1 kHz sysinfo stream produced 412 frames during the 1.2 s producer
  window; every produced frame was consumed with zero ring drop and zero
  sequence gap.
- shell ps path: 103.349 ms/run, about 9.7 runs/s.

The same source now also contains a Linux-native resident provider that keeps
/proc/stat, /proc/meminfo, /proc/net/dev and /proc/loadavg open, seeks them back
to zero, and reuses buffers instead of spawning processes:

- 10,000 samples in 1,524.295 ms.
- 152.43 us/sample, about 6,560 samples/s under the same loaded host.
- requested 1 kHz stream: 1201 produced / 1201 consumed in the 1.2 s producer
  window, zero ring drop, zero sequence gap.
- batch=32 remained 0.031640 Host-semantic calls/frame.

This is the strongest result in the first qualification: the 1 kHz miss moved
from the generic sysinfo provider to a native provider and disappeared without
changing the Host contract or the guest-visible Host operation set.

## WAsmC policy execution

policy.wasmc compiles with the released compiler into a 99-byte, import-free
Core Wasm module and is instantiated once.

Mac Node/V8 microbenchmark:

- compile: 14.65 ms.
- instantiate: 0.042 ms.
- 5,000,000 resident policy calls: 21.26 ms, about 4.25 ns/call.

Linux Node/V8 microbenchmark using the exact same 99-byte Wasm
(SHA-256 cccd468e2e6da26d328b73a7bb0d264a7e9c42c783815c310fc699814e01c2e8):

- 5,000,000 calls: 94.81 ms, about 18.96 ns/call.

These are JIT microbenchmarks and must not be promoted to whole-system
throughput claims. Their purpose is narrower: local resident WAsmC policy
execution is orders of magnitude away from being the bottleneck in this
telemetry experiment.

## Direct guest resource pull

A probe that attempted to express endpoint/window resources inline in ordinary
WAsmC source was rejected by the released source parser. LANGUAGE.md also
states that resources use the matching published WIT Lib path rather than raw
handle/layout manipulation.

Therefore this qualification proves:

1. the existing Host semantic vocabulary is sufficient;
2. the existing physical Endpoint/Window/Operation transport has enough
   per-node headroom;
3. real OS collection can live in a provider without Host API growth;
4. WAsmC can already execute the local policy layer cheaply;
5. direct WAsmC-owned telemetry-resource pull is **not yet claimed**.

The missing work for item 5 is generic WIT resource binding/lowering and the
corresponding existing-Host physical adapter. It must not be "solved" by
adding telemetry-specific Host calls.

## Next engineering slice

Keep Host API delta at zero.

1. Add provider-side cadence groups: slow CPU/load identity, medium
   memory/process, faster network counters where the OS backend supports it.
2. Add a Linux fast backend and compare it against sysinfo while preserving the
   same 64-byte-or-batched provider contract. The first /proc proof is now
   complete; next remove avoidable parser allocations and define cadence groups.
3. Feed batches into Data Foundation lag/frame aggregates rather than computing
   rates in Host.
4. Close the existing generic WIT resource binding/lowering so WAsmC source can
   directly drive open/read/wait/window without a telemetry-specific escape
   hatch.
5. Treat the 100,000-node gateway/fanout test as a separate scale
   qualification; this document is a node-side and per-stream qualification.
