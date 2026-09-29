# WAsmC public performance

Commit: f707b47985590fabf48da312b5ecf347e20b150b
Measured: 2026-09-29T09:28:42.199Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 13.801 ms | 0.91x | 43.519 ms | 23.575 ms | 10.615 ms | 0.90x | 3.656 ms | 0.88x |
| linux-x86_64 | within-baseline | 11.11 MiB | 13.838 ms | 1.15x | 39.348 ms | 21.611 ms | 10.265 ms | 1.16x | 2.675 ms | 1.21x |
| macos-aarch64 | within-baseline | 8.32 MiB | 18.287 ms | 1.06x | 48.625 ms | 28.888 ms | 17.506 ms | 1.01x | 3.773 ms | 1.12x |
| macos-x86_64 | within-baseline | 10.21 MiB | 28.666 ms | 0.84x | 75.346 ms | 55.832 ms | 24.988 ms | 0.81x | 6.769 ms | 0.90x |
| windows-aarch64 | within-baseline | 8.89 MiB | 26.389 ms | 0.96x | 55.122 ms | 35.789 ms | 18.879 ms | 0.93x | 18.054 ms | 0.97x |
| windows-x86_64 | within-baseline | 10.13 MiB | 21.166 ms | 1.02x | 55.752 ms | 30.039 ms | 18.339 ms | 1.11x | 11.414 ms | 1.18x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
