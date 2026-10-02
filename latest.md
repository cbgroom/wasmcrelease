# WAsmC public performance

Commit: 2b05592443690f8f7c020c4fb8370390250ab08d
Measured: 2026-10-02T19:16:49.813Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.734 ms | 1.01x | 45.861 ms | 25.811 ms | 11.545 ms | 1.01x | 3.925 ms | 1.03x |
| linux-x86_64 | within-baseline | 11.30 MiB | 11.030 ms | 0.89x | 31.524 ms | 18.106 ms | 8.074 ms | 0.91x | 1.839 ms | 0.85x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 23.026 ms | 1.06x | 80.493 ms | 41.965 ms | 24.221 ms | 1.50x | 6.086 ms | 1.84x |
| macos-x86_64 | within-baseline | 10.39 MiB | 33.664 ms | 0.94x | 83.105 ms | 70.713 ms | 26.766 ms | 0.91x | 8.012 ms | 0.97x |
| windows-aarch64 | within-baseline | 9.07 MiB | 28.118 ms | 1.02x | 57.774 ms | 37.878 ms | 20.808 ms | 1.05x | 19.096 ms | 1.06x |
| windows-x86_64 | within-baseline | 10.32 MiB | 21.637 ms | 1.01x | 55.898 ms | 31.937 ms | 17.945 ms | 1.08x | 10.488 ms | 1.03x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
