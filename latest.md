# WAsmC public performance

Commit: 7e66609ce71a62e82328fa4ed313cf21efd2c742
Measured: 2026-10-02T19:56:31.539Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.497 ms | 0.96x | 45.316 ms | 24.987 ms | 11.337 ms | 0.98x | 3.856 ms | 0.98x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.565 ms | 1.01x | 42.658 ms | 24.325 ms | 9.207 ms | 1.04x | 2.178 ms | 1.03x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 27.109 ms | 1.18x | 60.602 ms | 43.634 ms | 24.131 ms | 1.18x | 6.089 ms | 1.40x |
| macos-x86_64 | within-baseline | 10.39 MiB | 31.393 ms | 0.95x | 89.041 ms | 58.309 ms | 26.544 ms | 0.99x | 9.024 ms | 1.13x |
| windows-aarch64 | within-baseline | 9.07 MiB | 28.768 ms | 1.07x | 59.692 ms | 38.865 ms | 21.367 ms | 1.11x | 19.337 ms | 1.10x |
| windows-x86_64 | within-baseline | 10.32 MiB | 20.216 ms | 0.95x | 55.747 ms | 31.051 ms | 16.012 ms | 0.93x | 9.499 ms | 0.97x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
