# WAsmC public performance

Commit: 0489215f024a75c70adb8bd961c26f31ddb3a0a3
Measured: 2026-09-29T03:22:01.174Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 15.143 ms | 1.06x | 47.284 ms | 26.502 ms | 11.501 ms | 0.96x | 4.132 ms | 0.97x |
| linux-x86_64 | within-baseline | 11.11 MiB | 12.038 ms | 1.01x | 43.049 ms | 23.812 ms | 8.638 ms | 0.98x | 2.129 ms | 0.98x |
| macos-aarch64 | within-baseline | 8.32 MiB | 16.890 ms | 0.88x | 44.235 ms | 28.609 ms | 14.916 ms | 0.96x | 2.102 ms | 0.81x |
| macos-x86_64 | advisory-regression | 10.21 MiB | 51.327 ms | 1.50x | 132.059 ms | 84.745 ms | 44.970 ms | 1.50x | 11.132 ms | 1.47x |
| windows-aarch64 | within-baseline | 8.89 MiB | 27.541 ms | 0.99x | 56.716 ms | 37.230 ms | 20.282 ms | 1.02x | 18.690 ms | 1.02x |
| windows-x86_64 | within-baseline | 10.13 MiB | 16.567 ms | 0.82x | 45.738 ms | 26.787 ms | 13.052 ms | 0.83x | 7.460 ms | 0.79x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
