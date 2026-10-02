# WAsmC public performance

Commit: 5e7cc8403a8e1f707211dd31f799f08511368fab
Measured: 2026-10-02T07:45:42.899Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 15.416 ms | 1.05x | 48.003 ms | 27.064 ms | 12.099 ms | 1.06x | 4.159 ms | 1.06x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.265 ms | 0.95x | 44.653 ms | 24.241 ms | 8.858 ms | 0.96x | 2.264 ms | 1.04x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 21.986 ms | 1.14x | 68.184 ms | 37.445 ms | 19.136 ms | 1.14x | 2.796 ms | 0.79x |
| macos-x86_64 | within-baseline | 10.39 MiB | 30.629 ms | 0.80x | 72.057 ms | 47.600 ms | 21.929 ms | 0.69x | 6.195 ms | 0.68x |
| windows-aarch64 | within-baseline | 9.07 MiB | 28.154 ms | 1.01x | 58.177 ms | 38.046 ms | 20.166 ms | 0.99x | 18.314 ms | 0.97x |
| windows-x86_64 | within-baseline | 10.32 MiB | 21.736 ms | 0.98x | 59.633 ms | 35.576 ms | 17.400 ms | 1.01x | 11.207 ms | 1.10x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
