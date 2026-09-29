# WAsmC public performance

Commit: bb119566b100d49611d4a199fc9595e5aabba526
Measured: 2026-09-29T04:37:36.811Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 15.595 ms | 1.09x | 47.622 ms | 26.985 ms | 11.808 ms | 1.03x | 4.157 ms | 1.01x |
| linux-x86_64 | within-baseline | 11.11 MiB | 12.916 ms | 1.08x | 38.161 ms | 20.621 ms | 9.166 ms | 1.06x | 2.333 ms | 1.07x |
| macos-aarch64 | advisory-regression | 8.32 MiB | 17.229 ms | 0.90x | 40.373 ms | 23.714 ms | 17.293 ms | 1.16x | 3.970 ms | 1.53x |
| macos-x86_64 | advisory-regression | 10.21 MiB | 38.577 ms | 1.13x | 100.461 ms | 66.564 ms | 35.482 ms | 1.14x | 9.693 ms | 1.28x |
| windows-aarch64 | within-baseline | 8.89 MiB | 28.182 ms | 1.02x | 58.180 ms | 38.330 ms | 20.305 ms | 1.01x | 18.894 ms | 1.01x |
| windows-x86_64 | advisory-regression | 10.13 MiB | 22.013 ms | 1.33x | 57.285 ms | 32.279 ms | 17.536 ms | 1.34x | 9.683 ms | 1.30x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
