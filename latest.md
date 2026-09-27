# WAsmC public performance

Commit: c484f8bd201640c1a4996771347ed8e8f43ce5dd
Measured: 2026-09-27T02:08:36.729Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | advisory-regression | 9.38 MiB | 15.980 ms | 1.14x | 49.164 ms | 28.489 ms | 12.352 ms | 1.15x | 4.683 ms | 1.26x |
| linux-x86_64 | within-baseline | 11.11 MiB | 12.147 ms | 1.04x | 42.529 ms | 23.616 ms | 8.900 ms | 1.00x | 2.208 ms | 1.02x |
| macos-aarch64 | within-baseline | 8.32 MiB | 16.610 ms | 0.92x | 38.222 ms | 22.590 ms | 13.650 ms | 0.89x | 2.290 ms | 0.93x |
| macos-x86_64 | within-baseline | 10.21 MiB | 30.352 ms | 0.84x | 79.109 ms | 60.031 ms | 22.258 ms | 0.78x | 6.011 ms | 0.77x |
| windows-aarch64 | within-baseline | 8.89 MiB | 29.628 ms | 1.07x | 60.689 ms | 39.903 ms | 21.910 ms | 1.08x | 20.260 ms | 1.06x |
| windows-x86_64 | advisory-regression | 10.13 MiB | 20.798 ms | 1.28x | 55.834 ms | 31.016 ms | 17.123 ms | 1.29x | 10.277 ms | 1.33x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
