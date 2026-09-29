# WAsmC public performance

Commit: 2e9df145d1179784c137b599374c3dcb112bf826
Measured: 2026-09-29T09:38:08.494Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 13.919 ms | 0.97x | 44.169 ms | 24.176 ms | 11.029 ms | 0.96x | 3.772 ms | 0.91x |
| linux-x86_64 | within-baseline | 11.11 MiB | 12.291 ms | 0.97x | 45.307 ms | 24.180 ms | 8.557 ms | 0.94x | 2.312 ms | 1.02x |
| macos-aarch64 | advisory-regression | 8.32 MiB | 23.272 ms | 1.35x | 67.079 ms | 41.727 ms | 16.498 ms | 0.95x | 4.006 ms | 1.19x |
| macos-x86_64 | within-baseline | 10.21 MiB | 28.876 ms | 0.84x | 72.532 ms | 47.221 ms | 21.914 ms | 0.71x | 6.627 ms | 0.88x |
| windows-aarch64 | within-baseline | 8.89 MiB | 27.395 ms | 1.00x | 57.443 ms | 37.458 ms | 20.109 ms | 1.01x | 18.724 ms | 1.02x |
| windows-x86_64 | within-baseline | 10.13 MiB | 21.621 ms | 1.04x | 60.212 ms | 32.213 ms | 16.867 ms | 1.02x | 10.586 ms | 1.09x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
