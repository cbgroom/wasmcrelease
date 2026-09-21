# WAsmC public performance

Commit: 923e8bc5ede22d8bc4e2859a04f3efb3e23bdc6d
Measured: 2026-09-21T19:03:59.475Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 14.197 ms | 1.03x | 44.726 ms | 24.448 ms | 11.129 ms | 1.03x | 3.760 ms | 1.01x |
| linux-x86_64 | within-baseline | 11.11 MiB | 11.732 ms | 1.00x | 41.235 ms | 23.380 ms | 8.324 ms | 0.89x | 2.167 ms | 1.01x |
| macos-aarch64 | within-baseline | 8.32 MiB | 18.962 ms | 0.84x | 44.156 ms | 28.920 ms | 15.417 ms | 0.85x | 2.269 ms | 0.60x |
| macos-x86_64 | within-baseline | 10.21 MiB | 36.339 ms | 0.92x | 87.862 ms | 60.273 ms | 28.492 ms | 0.82x | 6.687 ms | 0.74x |
| windows-aarch64 | within-baseline | 8.89 MiB | 29.286 ms | 1.08x | 60.029 ms | 39.079 ms | 21.964 ms | 1.11x | 20.123 ms | 1.10x |
| windows-x86_64 | within-baseline | 10.13 MiB | 15.717 ms | 0.76x | 46.746 ms | 28.302 ms | 12.207 ms | 0.75x | 7.747 ms | 0.81x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
