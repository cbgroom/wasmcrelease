# WAsmC public performance

Commit: e0994aea59c3ac98f50c4ce591fdba6cf5d8b3da
Measured: 2026-10-02T09:33:35.871Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.375 ms | 0.98x | 45.200 ms | 25.268 ms | 11.425 ms | 1.00x | 3.799 ms | 0.97x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.103 ms | 1.12x | 42.344 ms | 24.465 ms | 8.648 ms | 1.11x | 2.179 ms | 1.18x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 21.622 ms | 1.09x | 53.286 ms | 33.753 ms | 22.017 ms | 1.29x | 4.052 ms | 1.40x |
| macos-x86_64 | within-baseline | 10.39 MiB | 38.142 ms | 1.19x | 96.386 ms | 61.723 ms | 30.561 ms | 1.11x | 8.295 ms | 0.83x |
| windows-aarch64 | within-baseline | 9.07 MiB | 27.607 ms | 1.00x | 57.871 ms | 38.029 ms | 20.404 ms | 1.00x | 18.710 ms | 1.02x |
| windows-x86_64 | within-baseline | 10.32 MiB | 16.561 ms | 0.81x | 45.885 ms | 26.222 ms | 13.320 ms | 0.79x | 7.221 ms | 0.75x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
