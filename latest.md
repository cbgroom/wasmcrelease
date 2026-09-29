# WAsmC public performance

Commit: e84f55f38146298842c27238e1338f236d3f2bde
Measured: 2026-09-29T12:19:14.042Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.437 ms | 0.95x | 45.181 ms | 24.895 ms | 11.323 ms | 0.98x | 3.808 ms | 0.92x |
| linux-x86_64 | within-baseline | 11.30 MiB | 10.532 ms | 0.83x | 30.991 ms | 17.436 ms | 7.630 ms | 0.83x | 1.839 ms | 0.79x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 25.375 ms | 1.39x | 78.732 ms | 49.444 ms | 25.924 ms | 1.50x | 4.867 ms | 1.23x |
| macos-x86_64 | within-baseline | 10.39 MiB | 28.885 ms | 0.91x | 75.518 ms | 46.609 ms | 24.248 ms | 0.93x | 5.890 ms | 0.86x |
| windows-aarch64 | within-baseline | 9.07 MiB | 26.638 ms | 0.97x | 55.726 ms | 36.195 ms | 18.636 ms | 0.92x | 17.280 ms | 0.92x |
| windows-x86_64 | within-baseline | 10.32 MiB | 21.579 ms | 1.02x | 57.852 ms | 30.741 ms | 17.133 ms | 1.02x | 10.369 ms | 1.07x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
