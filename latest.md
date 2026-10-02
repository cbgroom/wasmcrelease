# WAsmC public performance

Commit: abb99795c9c89d2fb3778d2bed7fa2494862fd71
Measured: 2026-10-02T09:17:44.203Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.619 ms | 0.99x | 45.591 ms | 25.707 ms | 11.442 ms | 1.00x | 3.902 ms | 0.99x |
| linux-x86_64 | within-baseline | 11.30 MiB | 10.758 ms | 0.88x | 31.740 ms | 17.664 ms | 7.797 ms | 0.88x | 1.843 ms | 0.81x |
| macos-aarch64 | within-baseline | 8.48 MiB | 19.801 ms | 0.98x | 47.138 ms | 30.424 ms | 17.046 ms | 0.89x | 2.896 ms | 0.86x |
| macos-x86_64 | advisory-regression | 10.39 MiB | 44.087 ms | 1.37x | 109.053 ms | 72.643 ms | 42.202 ms | 1.54x | 12.100 ms | 1.29x |
| windows-aarch64 | within-baseline | 9.07 MiB | 27.707 ms | 0.99x | 57.826 ms | 38.068 ms | 20.635 ms | 1.01x | 18.546 ms | 1.01x |
| windows-x86_64 | within-baseline | 10.32 MiB | 21.757 ms | 1.06x | 57.377 ms | 31.846 ms | 17.055 ms | 1.02x | 9.525 ms | 0.96x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
