# WAsmC public performance

Commit: f5e7e14864de1a480b351872721ac6dc840215fc
Measured: 2026-10-02T18:52:17.444Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 15.122 ms | 1.03x | 46.579 ms | 26.560 ms | 11.799 ms | 1.03x | 4.135 ms | 1.09x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.408 ms | 1.03x | 43.692 ms | 24.178 ms | 8.836 ms | 1.02x | 2.121 ms | 0.98x |
| macos-aarch64 | within-baseline | 8.48 MiB | 17.721 ms | 0.82x | 42.975 ms | 25.102 ms | 16.146 ms | 0.95x | 2.628 ms | 0.80x |
| macos-x86_64 | advisory-regression | 10.39 MiB | 43.303 ms | 1.20x | 111.131 ms | 70.728 ms | 35.089 ms | 1.19x | 9.016 ms | 1.09x |
| windows-aarch64 | within-baseline | 9.07 MiB | 27.910 ms | 1.01x | 59.363 ms | 37.019 ms | 19.751 ms | 0.97x | 17.534 ms | 0.95x |
| windows-x86_64 | within-baseline | 10.32 MiB | 21.361 ms | 0.99x | 61.568 ms | 36.523 ms | 17.192 ms | 1.03x | 10.371 ms | 1.06x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
