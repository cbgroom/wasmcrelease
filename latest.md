# WAsmC public performance

Commit: 63ca6c05515de93d6a8d9f8825807313ef882cf7
Measured: 2026-09-29T15:49:55.943Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 15.039 ms | 1.04x | 46.570 ms | 26.292 ms | 11.691 ms | 1.03x | 4.063 ms | 1.07x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.357 ms | 0.98x | 44.480 ms | 24.330 ms | 8.903 ms | 0.96x | 2.186 ms | 0.92x |
| macos-aarch64 | within-baseline | 8.48 MiB | 15.662 ms | 0.67x | 37.672 ms | 22.563 ms | 13.698 ms | 0.78x | 2.213 ms | 0.55x |
| macos-x86_64 | within-baseline | 10.39 MiB | 28.044 ms | 0.97x | 70.694 ms | 46.035 ms | 24.199 ms | 1.00x | 6.166 ms | 0.93x |
| windows-aarch64 | within-baseline | 9.07 MiB | 27.482 ms | 1.00x | 57.628 ms | 37.623 ms | 20.019 ms | 1.00x | 18.767 ms | 1.00x |
| windows-x86_64 | within-baseline | 10.32 MiB | 20.896 ms | 0.99x | 56.020 ms | 30.666 ms | 17.317 ms | 1.03x | 9.973 ms | 0.96x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
