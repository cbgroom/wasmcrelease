# WAsmC public performance

Commit: dca549848b518b0a528c1b9825c34737845ea248
Measured: 2026-09-29T03:07:37.356Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 14.839 ms | 1.04x | 46.038 ms | 26.089 ms | 11.565 ms | 1.05x | 4.035 ms | 1.05x |
| linux-x86_64 | within-baseline | 11.11 MiB | 11.700 ms | 0.99x | 42.012 ms | 23.803 ms | 8.261 ms | 0.98x | 2.106 ms | 0.97x |
| macos-aarch64 | within-baseline | 8.32 MiB | 15.797 ms | 0.83x | 37.786 ms | 23.688 ms | 14.059 ms | 0.90x | 1.900 ms | 0.73x |
| macos-x86_64 | within-baseline | 10.21 MiB | 29.219 ms | 0.85x | 86.636 ms | 57.495 ms | 25.272 ms | 0.84x | 7.438 ms | 0.98x |
| windows-aarch64 | within-baseline | 8.89 MiB | 27.281 ms | 0.98x | 56.752 ms | 37.011 ms | 20.304 ms | 1.05x | 18.582 ms | 1.04x |
| windows-x86_64 | within-baseline | 10.13 MiB | 16.706 ms | 0.80x | 40.211 ms | 24.564 ms | 12.924 ms | 0.78x | 7.362 ms | 0.75x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
