# WAsmC public performance

Commit: 682fe7e27b8b63d9d1f651b7ad21dfb6cd7bf533
Measured: 2026-09-29T13:09:07.575Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.941 ms | 1.03x | 46.804 ms | 26.600 ms | 11.572 ms | 1.02x | 4.003 ms | 1.05x |
| linux-x86_64 | within-baseline | 11.30 MiB | 13.774 ms | 1.09x | 39.041 ms | 21.909 ms | 10.106 ms | 1.10x | 2.410 ms | 1.03x |
| macos-aarch64 | within-baseline | 8.48 MiB | 15.065 ms | 0.65x | 35.773 ms | 22.607 ms | 14.144 ms | 0.81x | 2.199 ms | 0.55x |
| macos-x86_64 | within-baseline | 10.39 MiB | 27.045 ms | 0.94x | 75.834 ms | 53.487 ms | 21.754 ms | 0.87x | 5.531 ms | 0.82x |
| windows-aarch64 | within-baseline | 9.07 MiB | 28.279 ms | 1.03x | 57.844 ms | 38.048 ms | 20.451 ms | 1.02x | 18.797 ms | 1.00x |
| windows-x86_64 | within-baseline | 10.32 MiB | 20.544 ms | 0.95x | 54.595 ms | 29.898 ms | 16.176 ms | 0.94x | 9.711 ms | 0.94x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
