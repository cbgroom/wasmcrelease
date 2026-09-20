# Telemetry Lib over frozen generic Host qualification

## Decision

The current qualification supports the stronger architecture:

**Host stays generic; telemetry expands as a Lib.**

The target Linux path is:

trusted embedding preopens ordinary file resources -> generic namespace/open ->
opaque endpoint + generic read/window -> TelemetryLib parser/cadence/frame.

There is no telemetry-specific Host API, Host opcode, Host schema or
TelemetryProvider abstraction in that path.

The experiment-local GenericResourceHost mirrors the cold selector/open and hot
opaque-resource read semantics required by the existing Host contract. It is
not a new product Host layer. Exact source-generated WAsmC window/read
integration remains owned by the separate generic Host I/O workstream; this
benchmark does not claim that unfinished work as complete.

## Authority and invariant

- Base: origin/main at f81b598f11198e0d801ec21dd95d585ff495953b
  (v0.0.11 production/main baseline).
- Development node: youdeMac-mini.local, Darwin arm64.
- Linux cross-platform node: huawei-ThinkCentre-M920t, Linux x86_64.
- host/contract/v0/host.wit was not modified.
- Host Core receives no telemetry-specific code.
- Trusted Linux harness configuration registers ordinary preopened file
  resources; the generic resource table does not parse their selector names.
- Hot frame size: fixed 64 bytes; bounded ring; binary encoding; no JSON in the
  resident path.
- The current hot-frame schema is frame-schema-v2.json. Static/cold facts such
  as total physical memory do not consume every hot frame.
- freshness_mask distinguishes a newly refreshed OS observation from a
  carried-forward cached value. A 1 kHz frame therefore does not imply that
  every field was physically sampled at 1 kHz.
- Frame v2 removes backend/platform/provider identity entirely. The final 32
  bits are generic reserved flags and are zero today.

## Authoritative Lib-over-generic-resource result

The current target architecture is qualified separately from the older
telemetry-endpoint stress model. Exact experiment source SHA-256:
5c434b32ef8cab1a00ae5b264dec8871909dbef13a754fe9e1eea00c17743a89.

The trusted Linux harness preopens four ordinary files and registers them in a
generic selector table. GenericResourceHost only implements cold open(selector)
and hot read(endpoint, window); it has no CPU, memory, network, /proc or
telemetry branching. LinuxTelemetryLib owns selector choice, parsing, cadence,
freshness and Frame v2 construction.

On the loaded Linux x86_64 node:

- fast burst: 20,000 frames in 2,464.993 ms, about 8,113.6 frames/s.
  The Lib performed 40,269 generic reads, 2.01345 reads/frame, with zero hot
  heap allocations.
- fast 1 kHz: 5,000 frames at 1,000.157 Hz, 19.006% sampler-thread CPU,
  2.1046 generic reads/frame. CPU/network were fresh on all 5,000 frames,
  memory 473 times and load 50 times. Zero hot allocations.
- balanced 1 kHz: 5,000 frames at 1,000.187 Hz, 3.028% sampler-thread CPU,
  0.2944 generic reads/frame. CPU/memory/network were refreshed 474 times each
  and load 50 times. Zero hot allocations.
- economy 1 kHz: 5,000 frames at 1,000.188 Hz, 1.496% sampler-thread CPU,
  0.0604 generic reads/frame. CPU/memory/network were refreshed 99 times each
  and load 5 times. Zero hot allocations.

These profiles are Lib policy, not Host API variants. They demonstrate that a
1 kHz application-facing frame clock does not require a 1 kHz syscall/read
rate for every field.

The experiment also tried a Linux positional pread implementation behind the
same generic read semantic. It did not show a stable improvement: burst
throughput fell to about 7,696.6 frames/s; fast CPU improved only slightly
(19.006% -> 18.601%) while balanced/economy did not improve. The candidate is
therefore rejected; the experiment keeps the simpler generic file semantics.

Raw receipts:
evidence/linux-generic-resource-lib.jsonl and
evidence/linux-generic-resource-pread-rejected.jsonl.

## Bounded loss is observable

A deterministic overrun control uses a 32-frame ring. After consuming sequence
1..8, the producer advances through sequence 80 without enough consumer
capacity. The ring reports 40 overwritten frames and the next visible sequence
is 49, yielding an exact sequence gap of 40. silent_loss=false.

This is the intended overload contract: bounded memory may discard oldest
samples, but loss is explicit through sequence discontinuity and must not be
silently interpreted as continuous telemetry.

## macOS arm64

Resident cross-platform sampler, sysinfo 0.39.6:

- full-refresh path: 2,000 snapshots in 995.683 ms, about 2,008.7 samples/s.
- sysinfo reports a 200 ms minimum CPU-usage update interval, so a faster sample
  cadence does not imply fresher CPU utilization values.
- cadence-aware 1 kHz output: 1201/1201 frames, zero ring drop/gap. During the
  1.2 s run only 6 CPU, 102 memory, 102 network and 12 load refreshes were
  marked fresh; all other values were explicitly carried-forward caches.

Shell comparison:

- 40 runs of sh -> ps took 1,237.759 ms.
- 30.944 ms/run, about 32.3 samples/s.
- This remains more than an order of magnitude slower than resident collection
  and additionally pays fork/exec and text-formatting costs. It is a local
  comparison, not a semantic-equivalence claim.

Historical telemetry-endpoint stress control:

- synthetic 1 kHz batch=32: 1201/1201, zero drop/gap and 0.031640
  read/wait calls per frame.
- cadence-aware sysinfo 1 kHz batch=32: 1201/1201, zero drop/gap and 0.031640
  calls/frame while preserving per-field freshness semantics.

In-memory transport isolation with 100,000 pre-produced frames:

- batch=1: 28.78M frames/s.
- batch=32: 192.14M frames/s, 0.031270 Host-semantic calls/frame.
- batch=256: 169.67M frames/s, 0.003930 calls/frame.

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

## Linux x86_64 historical controls

The exact same Rust source and Cargo.lock were copied byte-for-byte to the
Linux node. The machine was already heavily loaded during the run, so absolute
provider rates are intentionally not treated as stable capacity numbers.

Transport isolation:

- synthetic 1 kHz, batch=1: 1201/1201, zero drop/gap.
- synthetic 1 kHz, batch=32: 1201/1201, zero drop/gap, 0.031640
  calls/frame.
- 100,000-frame microbenchmark:
  - batch=1: 13.38M frames/s.
  - batch=32: 76.03M frames/s.
  - batch=256: 38.91M frames/s.

OS collection cost under load is separated from frame cadence. A full-refresh
sysinfo path remains too expensive to mean "every OS source is fresh every
millisecond", so the portable fallback uses independent refresh cadences and
marks freshness in-band rather than adding a Host API.

- full-refresh sysinfo: about 341.3 samples/s in this exact run.
- full-refresh sysinfo requested at 1 kHz produced 429 frames in the 1.2 s
  window.
- cadence-aware sysinfo requested at 1 kHz produced 1198/1198 frames, zero
  drop/gap, while marking only 6 CPU, 115 memory, 115 network and 12 load
  observations fresh.
- shell ps remained about 9.7 runs/s.

The older direct Linux control keeps /proc files open, seeks them back to zero,
and reuses buffers instead of spawning processes:

- exact final full-refresh run: 10,000 samples at about 6,703 samples/s.
- requested 1 kHz stream: 1201 produced / 1201 consumed in the 1.2 s producer
  window, zero ring drop, zero sequence gap.
- batch=32 remained 0.031640 Host-semantic calls/frame.

The older direct cadence path additionally removes parser allocations after
warmup. The measured hot loop performs zero heap allocations per sample. CPU
and network stay on the per-frame fast path; memory defaults to roughly 100 Hz
and load to roughly 10 Hz.

- 20,000 cadence-aware samples: 2,473.074 ms, about 8,087 samples/s.
- allocations=0 and allocated_bytes=0 across the measured 20,000-sample hot
  loop.
- 1 kHz stream: 1201/1201, zero drop/gap; freshness counts were CPU=1201,
  memory=114, network=1201 and load=12.

### Linux 1 kHz scheduling soak

A separate 5,000-frame absolute-cadence soak avoids confusing short-window
producer jitter with provider capacity:

- producer elapsed 4,999.259 ms; effective rate about 1,000.148 Hz.
- consumer received all 5,000 frames.
- ring_dropped=0 and sequence_gaps=0.
- 6 samples started more than one 1 ms period late; maximum observed lateness
  was about 1.904 ms on this non-real-time, heavily loaded host.

This means the throughput target is satisfied, but it is not a hard-real-time
claim. If a ROS control loop requires every 1 ms deadline rather than average
1 kHz telemetry throughput, worker scheduling/RT policy needs its own
qualification. That requirement still does not justify a telemetry-specific
Host API.

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

A probe against the released v0.0.11 source path that attempted to express
endpoint/window resources inline in ordinary WAsmC source was rejected.
LANGUAGE.md also states that resources use the matching published WIT Lib path
rather than raw handle/layout manipulation. This experiment therefore does not
claim that v0.0.11 can directly drive the telemetry resource loop from source.

Therefore this qualification proves:

1. the existing Host semantic vocabulary is sufficient;
2. the existing physical Endpoint/Window/Operation transport has enough
   per-node headroom;
3. TelemetryLib can consume ordinary generic Host file resources without any
   telemetry-specific Host API or provider abstraction;
4. WAsmC can already execute the local policy layer cheaply;
5. direct WAsmC-owned telemetry-resource pull is **not yet claimed**.

Any remaining direct-source resource/lifecycle work belongs to the generic WIT
resource maintainer path and its existing-Host physical adapter. It must not be
"solved" by adding telemetry-specific Host calls.

## Next engineering slice

Keep Host API delta at zero and expand the Lib ecosystem instead.

1. Incubate a wasmc-system-telemetry Lib candidate whose only external
   dependency is the generic Host Resource/Window/Operation contract.
2. Wait for the separately owned generic window/read/write H2 workstream to
   become clean/qualified, then run this Lib through the real generated WAsmC
   binding. Do not fork or special-case that workstream for telemetry.
3. Feed Frame v2 into Data Foundation lag/frame aggregates; delta/rate/window
   calculations stay outside Host.
4. Qualify macOS and Windows by mapping the same Lib-level semantics onto
   already admitted generic resources. If a platform exposes a genuine gap,
   first ask whether a more general Resource primitive is missing; never start
   from a telemetry-specific Host call.
5. Treat 100,000-node gateway/fanout as a separate scale qualification. This
   document is node-side/per-stream evidence only.
