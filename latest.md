# WAsmC public performance

Commit: 137022b0e66b2c22bb809850ca5d0c69d2a5f89a
Measured: 2026-10-02T19:22:29.516Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 15.152 ms | 1.03x | 45.805 ms | 25.426 ms | 11.473 ms | 0.99x | 3.986 ms | 1.02x |
| linux-x86_64 | within-baseline | 11.30 MiB | 13.267 ms | 1.07x | 39.048 ms | 21.648 ms | 9.637 ms | 1.09x | 2.387 ms | 1.13x |
| macos-aarch64 | within-baseline | 8.48 MiB | 18.783 ms | 0.86x | 53.344 ms | 34.766 ms | 16.476 ms | 1.02x | 3.736 ms | 1.13x |
| macos-x86_64 | within-baseline | 10.39 MiB | 33.034 ms | 0.98x | 90.040 ms | 67.755 ms | 25.517 ms | 0.94x | 6.582 ms | 0.81x |
| windows-aarch64 | within-baseline | 9.07 MiB | 26.764 ms | 0.96x | 56.281 ms | 36.561 ms | 19.157 ms | 0.97x | 17.628 ms | 0.98x |
| windows-x86_64 | within-baseline | 10.32 MiB | 21.656 ms | 1.01x | 57.768 ms | 32.472 ms | 17.270 ms | 1.00x | 9.373 ms | 0.92x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
