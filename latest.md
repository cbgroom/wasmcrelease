# WAsmC public performance

Commit: de1971cd59b5790757c23f3b847993c00c4e60a9
Measured: 2026-09-29T12:12:40.334Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 15.709 ms | 1.10x | 47.920 ms | 27.109 ms | 12.095 ms | 1.05x | 4.347 ms | 1.05x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.640 ms | 1.00x | 43.448 ms | 25.064 ms | 9.282 ms | 1.02x | 2.377 ms | 1.03x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 23.451 ms | 1.36x | 61.617 ms | 37.934 ms | 18.309 ms | 1.11x | 4.457 ms | 1.18x |
| macos-x86_64 | advisory-regression | 10.39 MiB | 31.706 ms | 1.10x | 103.497 ms | 69.585 ms | 25.955 ms | 1.04x | 6.855 ms | 1.01x |
| windows-aarch64 | within-baseline | 9.07 MiB | 28.475 ms | 1.04x | 58.480 ms | 38.236 ms | 20.843 ms | 1.04x | 18.797 ms | 1.01x |
| windows-x86_64 | within-baseline | 10.32 MiB | 20.166 ms | 0.95x | 54.466 ms | 29.811 ms | 16.175 ms | 0.96x | 9.658 ms | 1.00x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
