# WAsmC public performance

Commit: 83c9511be282c36f3dc3789517dc4a4995e0d493
Measured: 2026-10-02T07:51:19.386Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.337 ms | 0.93x | 44.237 ms | 24.741 ms | 11.272 ms | 0.93x | 3.771 ms | 0.91x |
| linux-x86_64 | within-baseline | 11.30 MiB | 10.220 ms | 0.83x | 30.663 ms | 17.106 ms | 7.449 ms | 0.84x | 1.816 ms | 0.83x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 25.249 ms | 1.27x | 71.299 ms | 40.166 ms | 27.302 ms | 1.63x | 6.525 ms | 1.88x |
| macos-x86_64 | within-baseline | 10.39 MiB | 32.096 ms | 0.83x | 84.190 ms | 55.749 ms | 27.487 ms | 0.86x | 9.943 ms | 1.16x |
| windows-aarch64 | within-baseline | 9.07 MiB | 27.505 ms | 0.99x | 57.646 ms | 37.068 ms | 20.306 ms | 1.01x | 18.174 ms | 0.98x |
| windows-x86_64 | within-baseline | 10.32 MiB | 20.447 ms | 0.94x | 56.135 ms | 30.260 ms | 16.797 ms | 0.97x | 9.935 ms | 0.92x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
