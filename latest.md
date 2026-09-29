# WAsmC public performance

Commit: 7f54fe1a54f6a52de0887da88747f0c564fb4c73
Measured: 2026-09-29T20:35:31.406Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.116 ms | 0.94x | 43.701 ms | 23.538 ms | 11.099 ms | 0.96x | 3.790 ms | 0.95x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.415 ms | 1.00x | 44.255 ms | 24.277 ms | 9.155 ms | 1.03x | 2.190 ms | 0.95x |
| macos-aarch64 | within-baseline | 8.48 MiB | 22.729 ms | 0.98x | 56.736 ms | 37.988 ms | 17.316 ms | 1.05x | 3.202 ms | 0.80x |
| macos-x86_64 | advisory-regression | 10.39 MiB | 31.193 ms | 1.08x | 79.869 ms | 52.206 ms | 28.608 ms | 1.18x | 7.812 ms | 1.27x |
| windows-aarch64 | within-baseline | 9.07 MiB | 27.208 ms | 0.99x | 57.065 ms | 36.904 ms | 20.219 ms | 1.01x | 18.214 ms | 0.97x |
| windows-x86_64 | within-baseline | 10.32 MiB | 23.238 ms | 1.11x | 59.075 ms | 33.216 ms | 19.137 ms | 1.13x | 10.277 ms | 1.03x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
