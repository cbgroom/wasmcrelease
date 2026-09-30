# WAsmC public performance

Commit: 4ca6374da5521d25b3c1c0449d1c6dfb9cffe811
Measured: 2026-09-30T16:34:55.016Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.699 ms | 1.00x | 46.221 ms | 26.140 ms | 11.419 ms | 1.00x | 3.933 ms | 1.02x |
| linux-x86_64 | advisory-regression | 11.30 MiB | 14.248 ms | 1.38x | 49.663 ms | 28.157 ms | 10.742 ms | 1.44x | 2.511 ms | 1.34x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 20.212 ms | 1.05x | 53.779 ms | 31.563 ms | 21.014 ms | 1.26x | 4.208 ms | 1.18x |
| macos-x86_64 | within-baseline | 10.39 MiB | 44.512 ms | 1.16x | 105.658 ms | 71.349 ms | 37.966 ms | 1.20x | 9.375 ms | 1.03x |
| windows-aarch64 | within-baseline | 9.07 MiB | 27.861 ms | 1.01x | 58.851 ms | 38.078 ms | 20.397 ms | 1.02x | 19.006 ms | 1.03x |
| windows-x86_64 | within-baseline | 10.32 MiB | 22.183 ms | 1.03x | 56.491 ms | 29.993 ms | 16.989 ms | 0.99x | 11.093 ms | 1.17x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
