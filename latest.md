# WAsmC public performance

Commit: c49933e0263ecac3fe085b6342a6508bfd7f2374
Measured: 2026-10-22T21:44:18.343Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | advisory-regression | 11.32 MiB | 19.059 ms | 1.28x | 52.484 ms | 32.236 ms | 15.127 ms | 1.31x | 4.282 ms | 1.09x |
| linux-x86_64 | advisory-regression | 13.68 MiB | 19.245 ms | 1.50x | 66.428 ms | 46.811 ms | 14.675 ms | 1.58x | 3.670 ms | 1.65x |
| macos-aarch64 | within-baseline | 10.32 MiB | 27.073 ms | 1.18x | 66.213 ms | 46.871 ms | 25.480 ms | 1.06x | 4.511 ms | 1.04x |
| macos-x86_64 | advisory-regression | 12.79 MiB | 42.739 ms | 1.36x | 99.168 ms | 71.836 ms | 39.767 ms | 1.54x | 7.459 ms | 1.13x |
| windows-aarch64 | within-baseline | 10.67 MiB | 31.829 ms | 1.19x | 59.705 ms | 41.471 ms | 23.741 ms | 1.23x | 17.380 ms | 0.99x |
| windows-x86_64 | within-baseline | 12.75 MiB | 19.469 ms | 0.90x | 51.662 ms | 36.278 ms | 15.692 ms | 0.91x | 8.012 ms | 0.84x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
