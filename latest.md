# WAsmC public performance

Commit: 7da7a45a1f7acc4fdbfa5318890d54948d2eed5c
Measured: 2026-10-02T19:48:46.099Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 15.169 ms | 1.03x | 45.712 ms | 26.535 ms | 11.815 ms | 1.03x | 3.917 ms | 1.00x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.798 ms | 1.03x | 45.268 ms | 25.058 ms | 9.309 ms | 1.05x | 2.297 ms | 1.08x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 29.658 ms | 1.58x | 78.554 ms | 51.533 ms | 25.453 ms | 1.54x | 4.336 ms | 1.16x |
| macos-x86_64 | within-baseline | 10.39 MiB | 26.010 ms | 0.79x | 67.228 ms | 42.940 ms | 21.139 ms | 0.79x | 5.297 ms | 0.66x |
| windows-aarch64 | within-baseline | 9.07 MiB | 26.499 ms | 0.98x | 55.583 ms | 36.150 ms | 19.250 ms | 1.00x | 17.397 ms | 0.98x |
| windows-x86_64 | within-baseline | 10.32 MiB | 18.374 ms | 0.86x | 46.935 ms | 27.040 ms | 14.933 ms | 0.87x | 8.515 ms | 0.84x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
