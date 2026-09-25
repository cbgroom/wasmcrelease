# System telemetry release candidate

**Candidate, not an admitted or released WAsmC Lib.** Based on the public
generic-resource telemetry experiment at
`8522ccd20498dc369c3aaf5e2bb604a55cf89c17`. Compiler, CoreLib and Host contracts
are unchanged. Historical benchmark timings do not qualify this successor.

## Implemented boundary

This pure library accepts complete caller-authorized Linux proc-format
snapshots and caller-provided monotonic timestamps. It computes CPU counter
deltas, available memory, used swap, network byte totals excluding loopback,
and one-minute load. Cadence and freshness are Lib policy. It does not open
files, read clocks, run commands or access a network.

Each supplied snapshot is bounded to 262,144 UTF-8 bytes. All required inputs
are checked before committing state; failures preserve counters, sequence and
cache. CPU rate is `none` on initial baseline, reset or no counter progress,
not a fabricated zero. Cached frames clear freshness bits. A refreshed resource
does not imply that the OS independently sampled the metric at frame cadence.

The embedding must bound allocation before Canonical ABI lowering, memory/fuel,
resource count, and complete resource reads. A guest-side length check alone
does not prove hostile input admission. Native borrowed input and Component
copied values share semantics, not an O(1) payload-transfer claim.

| Policy | CPU | Memory | Network | Load |
|---|---:|---:|---:|---:|
| fast | every call | 10 ms | every call | 100 ms |
| balanced | 10 ms | 10 ms | 10 ms | 100 ms |
| economy | 50 ms | 50 ms | 50 ms | 1 s |

CPU uses idle+iowait and does not double-count guest/guest_nice. Arithmetic,
memory units, complete network rows and timestamps are checked. Load decimal
conversion truncates to thousandths without floating-point parsing.

## Wire v3, not the old v2 identity

`encode-frame` returns 64 little-endian bytes. u64 fields at offsets
0/8/16/24/32/40 are sequence, monotonic ns, available-memory bytes, used-swap
bytes, RX bytes and TX bytes. u32 fields at 48/52/56/60 are CPU milli-percent,
load milli, freshness mask and flags. Flags bit0 means CPU unavailable; a zero
numeric CPU field in that case is not a measured zero. Freshness bits0..3
represent CPU/memory/network/load. Pin this new v3 encoding explicitly; never
silently replace the previous experiment's flags-zero v2.

Ring buffers, transport backpressure and ring-overwrite loss tracking are not
implemented by this pure sampler. Their old experiment results are not claimed.

## Explicit Linux acquisition example

The example preopens exactly four read-only /proc resources and reuses buffers.
No arbitrary guest-supplied path is accepted. Short reads are accumulated;
capacity overflow rejects rather than parsing truncated data. Files close before
FD readback. This is application glue, not a telemetry-specific Host primitive.
Windows/macOS acquisition and generic Host SDK integration remain unqualified.

```sh
cargo test --manifest-path libsrc/wasmc-system-telemetry/Cargo.toml --locked --offline
cargo test --manifest-path libsrc/wasmc-system-telemetry/Cargo.toml --locked --offline --example linux
cargo run --manifest-path libsrc/wasmc-system-telemetry/Cargo.toml --release --locked --offline --example linux
```

This is a 100-frame smoke run, not a 1 kHz timing contract or deployed daemon.
Published WAsmC resource-method consumption, exact package discovery and
cross-platform/engine release gates remain pending. Refer to candidate evidence,
not this README, for current exact-source qualification.
