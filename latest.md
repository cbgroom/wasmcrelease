# WAsmC public performance

Commit: e6d50dece1ec0723ced1291ec6d98c6705314876
Measured: 2026-09-27T05:34:54.918Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 13.763 ms | 0.95x | 43.619 ms | 23.621 ms | 10.691 ms | 0.97x | 3.625 ms | 0.94x |
| linux-x86_64 | within-baseline | 11.11 MiB | 11.874 ms | 1.01x | 43.769 ms | 23.747 ms | 8.470 ms | 1.01x | 2.172 ms | 1.01x |
| macos-aarch64 | advisory-regression | 8.32 MiB | 23.275 ms | 1.27x | 61.752 ms | 40.446 ms | 20.368 ms | 1.41x | 3.373 ms | 1.31x |
| macos-x86_64 | within-baseline | 10.21 MiB | 34.226 ms | 0.99x | 94.733 ms | 61.216 ms | 31.025 ms | 1.03x | 7.551 ms | 0.92x |
| windows-aarch64 | within-baseline | 8.89 MiB | 25.664 ms | 0.89x | 54.547 ms | 35.530 ms | 18.724 ms | 0.93x | 17.036 ms | 0.90x |
| windows-x86_64 | within-baseline | 10.13 MiB | 20.793 ms | 0.97x | 56.088 ms | 30.180 ms | 16.564 ms | 1.00x | 9.855 ms | 0.97x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
