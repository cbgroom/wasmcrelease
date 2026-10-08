# WAsmC public performance

Commit: c888af39c11640644591ff42aeaf8b09f632f651
Measured: 2026-10-08T23:22:22.715Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.75 MiB | 16.650 ms | 1.10x | 50.058 ms | 29.659 ms | 12.886 ms | 1.12x | 4.314 ms | 1.10x |
| linux-x86_64 | within-baseline | 11.80 MiB | 14.408 ms | 1.15x | 39.638 ms | 23.017 ms | 10.921 ms | 1.19x | 2.406 ms | 1.10x |
| macos-aarch64 | advisory-regression | 8.71 MiB | 29.009 ms | 1.26x | 77.455 ms | 46.156 ms | 20.361 ms | 0.84x | 4.511 ms | 1.04x |
| macos-x86_64 | advisory-regression | 10.91 MiB | 42.381 ms | 1.28x | 107.531 ms | 70.738 ms | 35.011 ms | 1.32x | 8.367 ms | 1.04x |
| windows-aarch64 | within-baseline | 9.11 MiB | 26.826 ms | 0.96x | 53.047 ms | 35.085 ms | 19.280 ms | 0.98x | 15.857 ms | 0.90x |
| windows-x86_64 | within-baseline | 10.83 MiB | 23.132 ms | 1.08x | 59.904 ms | 33.193 ms | 18.075 ms | 1.05x | 10.407 ms | 1.10x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
