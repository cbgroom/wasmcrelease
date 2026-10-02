# WAsmC public performance

Commit: bbf13a1005969962e12223bc2f20bd84d8d5f130
Measured: 2026-10-02T08:52:58.529Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 13.975 ms | 0.93x | 43.457 ms | 23.339 ms | 11.149 ms | 0.92x | 3.682 ms | 0.89x |
| linux-x86_64 | within-baseline | 11.30 MiB | 10.825 ms | 0.88x | 37.379 ms | 21.326 ms | 7.253 ms | 0.82x | 1.776 ms | 0.78x |
| macos-aarch64 | within-baseline | 8.48 MiB | 18.990 ms | 0.94x | 42.446 ms | 30.220 ms | 15.550 ms | 0.81x | 3.380 ms | 0.97x |
| macos-x86_64 | advisory-regression | 10.39 MiB | 45.004 ms | 1.40x | 107.879 ms | 71.766 ms | 36.017 ms | 1.31x | 10.085 ms | 1.18x |
| windows-aarch64 | within-baseline | 9.07 MiB | 30.453 ms | 1.09x | 61.800 ms | 40.915 ms | 22.896 ms | 1.12x | 20.416 ms | 1.11x |
| windows-x86_64 | within-baseline | 10.32 MiB | 19.438 ms | 0.89x | 53.358 ms | 28.897 ms | 15.781 ms | 0.93x | 9.631 ms | 0.95x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
