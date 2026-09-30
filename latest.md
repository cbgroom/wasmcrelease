# WAsmC public performance

Commit: 88064c74b1d651dab5758b9f6c750df1a107de15
Measured: 2026-09-30T15:43:35.408Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 13.731 ms | 0.94x | 42.878 ms | 23.501 ms | 10.821 ms | 0.95x | 3.537 ms | 0.92x |
| linux-x86_64 | within-baseline | 11.30 MiB | 10.246 ms | 0.83x | 30.454 ms | 17.150 ms | 7.437 ms | 0.81x | 1.828 ms | 0.83x |
| macos-aarch64 | within-baseline | 8.48 MiB | 16.037 ms | 0.83x | 35.151 ms | 21.133 ms | 13.827 ms | 0.80x | 2.385 ms | 0.74x |
| macos-x86_64 | advisory-regression | 10.39 MiB | 38.706 ms | 1.24x | 107.492 ms | 69.809 ms | 41.567 ms | 1.45x | 12.682 ms | 1.62x |
| windows-aarch64 | within-baseline | 9.07 MiB | 27.580 ms | 1.00x | 57.415 ms | 37.374 ms | 20.013 ms | 0.99x | 18.465 ms | 0.98x |
| windows-x86_64 | within-baseline | 10.32 MiB | 20.020 ms | 0.96x | 56.805 ms | 29.939 ms | 15.868 ms | 0.92x | 9.478 ms | 0.98x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
