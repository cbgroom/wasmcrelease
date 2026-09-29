# WAsmC public performance

Commit: 01bb2f8d4e7a5e0402612a57ccca5ec8a8fae28d
Measured: 2026-09-29T03:10:32.780Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | advisory-regression | 9.38 MiB | 14.305 ms | 1.01x | 44.430 ms | 25.074 ms | 12.574 ms | 1.14x | 4.960 ms | 1.29x |
| linux-x86_64 | within-baseline | 11.11 MiB | 12.627 ms | 1.06x | 36.781 ms | 20.721 ms | 9.136 ms | 1.08x | 2.259 ms | 1.04x |
| macos-aarch64 | within-baseline | 8.32 MiB | 16.968 ms | 0.89x | 37.163 ms | 22.709 ms | 12.298 ms | 0.79x | 1.969 ms | 0.76x |
| macos-x86_64 | within-baseline | 10.21 MiB | 25.224 ms | 0.74x | 68.875 ms | 49.733 ms | 21.191 ms | 0.71x | 5.265 ms | 0.70x |
| windows-aarch64 | within-baseline | 8.89 MiB | 27.462 ms | 0.99x | 56.815 ms | 36.967 ms | 19.893 ms | 1.03x | 18.384 ms | 1.03x |
| windows-x86_64 | within-baseline | 10.13 MiB | 13.396 ms | 0.64x | 37.724 ms | 22.083 ms | 10.823 ms | 0.65x | 6.732 ms | 0.68x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
