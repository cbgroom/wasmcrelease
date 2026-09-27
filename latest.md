# WAsmC public performance

Commit: 41fe6073f524d8e8aa7bc0f0d2b6df4592187236
Measured: 2026-09-27T04:03:36.835Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 14.518 ms | 1.02x | 45.915 ms | 25.661 ms | 11.017 ms | 0.99x | 3.786 ms | 1.01x |
| linux-x86_64 | within-baseline | 11.11 MiB | 8.109 ms | 0.67x | 28.911 ms | 16.843 ms | 5.739 ms | 0.69x | 1.621 ms | 0.74x |
| macos-aarch64 | within-baseline | 8.32 MiB | 15.335 ms | 0.92x | 36.933 ms | 23.334 ms | 12.237 ms | 0.88x | 2.034 ms | 0.90x |
| macos-x86_64 | advisory-regression | 10.21 MiB | 37.681 ms | 1.11x | 96.348 ms | 64.710 ms | 32.218 ms | 1.25x | 8.769 ms | 1.31x |
| windows-aarch64 | within-baseline | 8.89 MiB | 30.214 ms | 1.06x | 62.196 ms | 40.651 ms | 22.106 ms | 1.07x | 21.035 ms | 1.08x |
| windows-x86_64 | within-baseline | 10.13 MiB | 22.075 ms | 1.08x | 56.380 ms | 30.476 ms | 16.559 ms | 1.03x | 11.046 ms | 1.15x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
