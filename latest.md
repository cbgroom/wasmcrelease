# WAsmC public performance

Commit: e0202c8b3c67a344c63856356ff751820e21deae
Measured: 2026-09-21T08:54:42.590Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 13.634 ms | 0.96x | 42.393 ms | 23.900 ms | 10.524 ms | 0.95x | 3.723 ms | 0.99x |
| linux-x86_64 | within-baseline | 11.11 MiB | 12.768 ms | 1.09x | 38.141 ms | 20.967 ms | 9.550 ms | 1.02x | 2.344 ms | 1.10x |
| macos-aarch64 | advisory-regression | 8.32 MiB | 24.116 ms | 1.07x | 66.516 ms | 48.154 ms | 23.412 ms | 1.33x | 5.147 ms | 1.51x |
| macos-x86_64 | within-baseline | 10.21 MiB | 41.930 ms | 1.06x | 113.087 ms | 72.043 ms | 41.808 ms | 1.21x | 9.034 ms | 0.89x |
| windows-aarch64 | within-baseline | 8.89 MiB | 26.993 ms | 0.98x | 56.160 ms | 36.566 ms | 19.911 ms | 1.01x | 19.186 ms | 1.05x |
| windows-x86_64 | within-baseline | 10.13 MiB | 16.188 ms | 0.79x | 40.874 ms | 24.658 ms | 13.310 ms | 0.82x | 7.599 ms | 0.76x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
