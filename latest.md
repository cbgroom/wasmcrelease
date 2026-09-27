# WAsmC public performance

Commit: 45968a265507bd6dd20af54e7417a82e316721ba
Measured: 2026-09-27T05:11:20.481Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 15.209 ms | 1.05x | 47.335 ms | 26.973 ms | 12.041 ms | 1.09x | 4.248 ms | 1.12x |
| linux-x86_64 | within-baseline | 11.11 MiB | 11.955 ms | 1.02x | 44.805 ms | 24.545 ms | 8.783 ms | 1.05x | 2.155 ms | 0.99x |
| macos-aarch64 | advisory-regression | 8.32 MiB | 18.326 ms | 1.13x | 51.633 ms | 31.065 ms | 15.588 ms | 1.27x | 2.579 ms | 1.28x |
| macos-x86_64 | advisory-regression | 10.21 MiB | 34.529 ms | 1.14x | 87.963 ms | 58.449 ms | 28.135 ms | 1.21x | 8.233 ms | 1.28x |
| windows-aarch64 | advisory-regression | 8.89 MiB | 28.867 ms | 1.05x | 72.956 ms | 38.176 ms | 18.798 ms | 0.92x | 17.867 ms | 0.95x |
| windows-x86_64 | within-baseline | 10.13 MiB | 20.118 ms | 0.96x | 53.974 ms | 29.021 ms | 15.699 ms | 0.94x | 9.410 ms | 0.92x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
