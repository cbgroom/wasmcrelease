# WAsmC public performance

Commit: 735cc7fea762ba76f96d443cf64e47a31f8a1cc6
Measured: 2026-09-21T19:19:15.720Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 14.009 ms | 0.99x | 44.490 ms | 24.792 ms | 10.737 ms | 0.97x | 3.647 ms | 0.97x |
| linux-x86_64 | within-baseline | 11.11 MiB | 12.232 ms | 1.04x | 42.135 ms | 24.440 ms | 8.922 ms | 0.95x | 2.198 ms | 1.01x |
| macos-aarch64 | within-baseline | 8.32 MiB | 16.751 ms | 0.75x | 39.030 ms | 22.119 ms | 15.399 ms | 0.87x | 3.317 ms | 0.98x |
| macos-x86_64 | within-baseline | 10.21 MiB | 33.856 ms | 0.93x | 86.216 ms | 55.698 ms | 25.766 ms | 0.75x | 7.845 ms | 0.93x |
| windows-aarch64 | within-baseline | 8.89 MiB | 28.478 ms | 1.05x | 57.943 ms | 38.131 ms | 20.701 ms | 1.05x | 19.443 ms | 1.05x |
| windows-x86_64 | within-baseline | 10.13 MiB | 14.724 ms | 0.75x | 42.409 ms | 24.019 ms | 10.954 ms | 0.69x | 6.504 ms | 0.68x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
