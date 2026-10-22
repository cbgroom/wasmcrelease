# WAsmC public performance

Commit: 56dafbde62935006b65a2ba807d833d7b1cdff57
Measured: 2026-10-22T21:48:32.380Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | advisory-regression | 11.32 MiB | 19.356 ms | 1.28x | 53.838 ms | 33.187 ms | 15.408 ms | 1.30x | 4.645 ms | 1.19x |
| linux-x86_64 | within-baseline | 13.68 MiB | 15.344 ms | 1.16x | 51.202 ms | 30.678 ms | 11.576 ms | 1.20x | 2.213 ms | 0.96x |
| macos-aarch64 | advisory-regression | 10.32 MiB | 32.814 ms | 1.21x | 93.311 ms | 58.807 ms | 25.793 ms | 1.07x | 3.668 ms | 0.85x |
| macos-x86_64 | advisory-regression | 12.79 MiB | 42.136 ms | 1.34x | 115.849 ms | 76.903 ms | 36.244 ms | 1.40x | 8.213 ms | 1.25x |
| windows-aarch64 | advisory-regression | 10.67 MiB | 32.250 ms | 1.21x | 60.537 ms | 42.315 ms | 24.236 ms | 1.26x | 17.270 ms | 0.99x |
| windows-x86_64 | within-baseline | 12.75 MiB | 22.063 ms | 1.09x | 51.132 ms | 32.055 ms | 17.662 ms | 1.10x | 7.433 ms | 0.79x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
