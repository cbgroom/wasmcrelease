# WAsmC public performance

Commit: 9077f634b0358cd17529cfa690f512f4165e9499
Measured: 2026-09-27T05:32:58.589Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | advisory-regression | 9.38 MiB | 15.803 ms | 1.11x | 49.270 ms | 28.744 ms | 12.302 ms | 1.12x | 5.112 ms | 1.35x |
| linux-x86_64 | within-baseline | 11.11 MiB | 11.971 ms | 1.02x | 42.517 ms | 24.279 ms | 8.859 ms | 1.06x | 2.204 ms | 1.02x |
| macos-aarch64 | advisory-regression | 8.32 MiB | 19.307 ms | 1.13x | 58.661 ms | 34.082 ms | 17.420 ms | 1.42x | 3.639 ms | 1.79x |
| macos-x86_64 | within-baseline | 10.21 MiB | 32.554 ms | 0.86x | 95.695 ms | 58.650 ms | 30.036 ms | 1.07x | 7.021 ms | 0.80x |
| windows-aarch64 | within-baseline | 8.89 MiB | 30.462 ms | 1.09x | 62.189 ms | 40.711 ms | 22.692 ms | 1.15x | 20.793 ms | 1.13x |
| windows-x86_64 | within-baseline | 10.13 MiB | 21.461 ms | 1.02x | 55.922 ms | 30.196 ms | 16.536 ms | 1.00x | 10.136 ms | 1.04x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
