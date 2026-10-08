# WAsmC public performance

Commit: 90fe37f33e53fa47707e7694da2fbfb30773110f
Measured: 2026-10-08T23:22:22.009Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.75 MiB | 14.883 ms | 0.98x | 44.963 ms | 25.800 ms | 11.880 ms | 1.03x | 3.828 ms | 0.98x |
| linux-x86_64 | within-baseline | 11.80 MiB | 13.477 ms | 1.07x | 45.415 ms | 26.117 ms | 9.822 ms | 1.07x | 2.231 ms | 1.02x |
| macos-aarch64 | within-baseline | 8.71 MiB | 22.440 ms | 0.97x | 55.321 ms | 38.518 ms | 19.351 ms | 0.80x | 3.851 ms | 0.89x |
| macos-x86_64 | within-baseline | 10.91 MiB | 28.783 ms | 0.87x | 71.287 ms | 46.574 ms | 25.851 ms | 0.97x | 5.933 ms | 0.74x |
| windows-aarch64 | within-baseline | 9.11 MiB | 26.100 ms | 0.94x | 52.412 ms | 34.483 ms | 19.029 ms | 0.96x | 15.565 ms | 0.88x |
| windows-x86_64 | within-baseline | 10.83 MiB | 22.321 ms | 1.04x | 55.863 ms | 33.260 ms | 18.228 ms | 1.06x | 9.639 ms | 1.01x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
