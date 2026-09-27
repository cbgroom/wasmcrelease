# WAsmC public performance

Commit: 978d5866b51c538eb510e7e10a15486f4171d2e7
Measured: 2026-09-27T02:21:55.699Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 13.858 ms | 0.98x | 43.209 ms | 23.103 ms | 10.654 ms | 0.96x | 3.668 ms | 0.98x |
| linux-x86_64 | within-baseline | 11.11 MiB | 12.144 ms | 1.00x | 42.848 ms | 24.149 ms | 8.353 ms | 0.94x | 2.334 ms | 1.06x |
| macos-aarch64 | within-baseline | 8.32 MiB | 16.178 ms | 0.97x | 39.332 ms | 21.064 ms | 12.004 ms | 0.78x | 1.914 ms | 0.84x |
| macos-x86_64 | advisory-regression | 10.21 MiB | 40.352 ms | 1.19x | 99.602 ms | 67.653 ms | 26.952 ms | 1.05x | 8.765 ms | 1.31x |
| windows-aarch64 | within-baseline | 8.89 MiB | 27.337 ms | 0.96x | 57.246 ms | 37.169 ms | 19.780 ms | 0.96x | 18.418 ms | 0.95x |
| windows-x86_64 | advisory-regression | 10.13 MiB | 20.978 ms | 1.30x | 56.920 ms | 30.552 ms | 16.639 ms | 1.25x | 9.782 ms | 1.26x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
