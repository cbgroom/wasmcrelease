# WAsmC public performance

Commit: e675229e181a4a801b1f06f8f0d8160e2772060f
Measured: 2026-10-24T17:53:39.358Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 11.32 MiB | 18.226 ms | 1.20x | 50.719 ms | 30.347 ms | 14.468 ms | 1.22x | 3.913 ms | 1.00x |
| linux-x86_64 | within-baseline | 13.69 MiB | 12.972 ms | 0.96x | 41.335 ms | 26.902 ms | 9.405 ms | 0.96x | 1.946 ms | 0.87x |
| macos-aarch64 | advisory-regression | 10.32 MiB | 28.453 ms | 1.05x | 69.545 ms | 42.884 ms | 29.879 ms | 1.17x | 5.456 ms | 1.26x |
| macos-x86_64 | within-baseline | 12.79 MiB | 38.410 ms | 1.22x | 86.890 ms | 64.767 ms | 33.027 ms | 1.24x | 6.706 ms | 0.90x |
| windows-aarch64 | within-baseline | 10.67 MiB | 32.374 ms | 1.13x | 60.545 ms | 41.540 ms | 24.413 ms | 1.14x | 17.524 ms | 1.01x |
| windows-x86_64 | within-baseline | 12.76 MiB | 22.963 ms | 1.14x | 53.220 ms | 33.550 ms | 19.198 ms | 1.20x | 8.838 ms | 1.04x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
