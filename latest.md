# WAsmC public performance

Commit: bd2420d47360d85e21b8646a9ef7596f25df587d
Measured: 2026-09-27T05:23:37.499Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 14.230 ms | 0.98x | 44.971 ms | 24.790 ms | 11.026 ms | 1.00x | 3.858 ms | 1.02x |
| linux-x86_64 | within-baseline | 11.11 MiB | 10.891 ms | 0.91x | 38.703 ms | 22.118 ms | 8.096 ms | 0.97x | 2.149 ms | 0.99x |
| macos-aarch64 | advisory-regression | 8.32 MiB | 19.094 ms | 1.15x | 45.471 ms | 28.858 ms | 14.426 ms | 1.18x | 2.596 ms | 1.28x |
| macos-x86_64 | advisory-regression | 10.21 MiB | 48.234 ms | 1.40x | 129.169 ms | 85.435 ms | 48.717 ms | 1.81x | 12.649 ms | 1.54x |
| windows-aarch64 | within-baseline | 8.89 MiB | 27.849 ms | 0.96x | 58.111 ms | 37.999 ms | 20.109 ms | 1.02x | 18.893 ms | 1.03x |
| windows-x86_64 | within-baseline | 10.13 MiB | 15.956 ms | 0.76x | 41.976 ms | 24.302 ms | 11.993 ms | 0.72x | 7.129 ms | 0.69x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
