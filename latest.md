# WAsmC public performance

Commit: a75ba1dc8c7ac0c46c470b306021e18660aa1a7c
Measured: 2026-10-02T18:40:16.255Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.619 ms | 1.02x | 45.850 ms | 25.844 ms | 11.455 ms | 1.00x | 3.804 ms | 1.00x |
| linux-x86_64 | within-baseline | 11.30 MiB | 10.302 ms | 0.85x | 31.043 ms | 17.645 ms | 7.462 ms | 0.86x | 1.811 ms | 0.84x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 25.773 ms | 1.30x | 63.293 ms | 48.256 ms | 20.493 ms | 1.32x | 6.672 ms | 2.02x |
| macos-x86_64 | within-baseline | 10.39 MiB | 29.996 ms | 0.79x | 78.636 ms | 49.482 ms | 27.224 ms | 0.89x | 8.163 ms | 0.98x |
| windows-aarch64 | within-baseline | 9.07 MiB | 26.904 ms | 0.97x | 56.831 ms | 36.945 ms | 19.305 ms | 0.95x | 18.079 ms | 0.97x |
| windows-x86_64 | within-baseline | 10.32 MiB | 21.375 ms | 0.99x | 57.084 ms | 33.940 ms | 15.575 ms | 0.93x | 9.775 ms | 1.01x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
