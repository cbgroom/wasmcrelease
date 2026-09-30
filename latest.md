# WAsmC public performance

Commit: a7a9e63277a3d693b02a114901ddefaa0f62d333
Measured: 2026-09-30T15:38:42.190Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.654 ms | 1.01x | 45.073 ms | 25.509 ms | 11.425 ms | 1.01x | 3.849 ms | 1.01x |
| linux-x86_64 | within-baseline | 11.30 MiB | 13.345 ms | 1.08x | 43.382 ms | 24.950 ms | 9.270 ms | 1.04x | 2.276 ms | 1.04x |
| macos-aarch64 | within-baseline | 8.48 MiB | 19.304 ms | 0.91x | 45.863 ms | 24.829 ms | 19.268 ms | 1.11x | 3.553 ms | 1.11x |
| macos-x86_64 | advisory-regression | 10.39 MiB | 34.669 ms | 1.20x | 99.981 ms | 68.051 ms | 31.643 ms | 1.30x | 9.130 ms | 1.48x |
| windows-aarch64 | within-baseline | 9.07 MiB | 28.891 ms | 1.06x | 59.130 ms | 39.042 ms | 21.203 ms | 1.06x | 19.814 ms | 1.09x |
| windows-x86_64 | within-baseline | 10.32 MiB | 22.536 ms | 1.08x | 57.342 ms | 32.524 ms | 17.235 ms | 1.01x | 9.370 ms | 0.94x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
