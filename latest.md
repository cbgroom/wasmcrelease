# WAsmC public performance

Commit: 503dd4ed22e3704b1dd9dce0b6923c73d6702344
Measured: 2026-10-24T18:36:52.098Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 11.32 MiB | 17.300 ms | 0.95x | 48.181 ms | 28.481 ms | 13.697 ms | 0.95x | 3.725 ms | 0.95x |
| linux-x86_64 | within-baseline | 13.69 MiB | 15.535 ms | 1.15x | 49.565 ms | 30.573 ms | 11.335 ms | 1.15x | 2.214 ms | 1.00x |
| macos-aarch64 | within-baseline | 10.32 MiB | 25.134 ms | 0.93x | 48.579 ms | 31.022 ms | 23.619 ms | 0.93x | 2.392 ms | 0.53x |
| macos-x86_64 | within-baseline | 12.79 MiB | 35.652 ms | 0.93x | 80.880 ms | 57.095 ms | 38.198 ms | 1.16x | 5.747 ms | 0.77x |
| windows-aarch64 | within-baseline | 10.67 MiB | 31.123 ms | 0.98x | 58.436 ms | 39.971 ms | 22.931 ms | 0.97x | 16.616 ms | 0.96x |
| windows-x86_64 | within-baseline | 12.76 MiB | 20.721 ms | 0.94x | 47.373 ms | 30.328 ms | 16.812 ms | 0.95x | 10.422 ms | 1.18x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
