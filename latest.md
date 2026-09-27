# WAsmC public performance

Commit: a2778df0391570ed9fe374017e4ab18f8b75475d
Measured: 2026-09-27T05:01:13.337Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 13.925 ms | 0.96x | 43.582 ms | 24.059 ms | 10.999 ms | 1.00x | 3.787 ms | 1.00x |
| linux-x86_64 | within-baseline | 11.11 MiB | 11.736 ms | 0.97x | 41.520 ms | 24.231 ms | 8.385 ms | 1.00x | 2.176 ms | 0.99x |
| macos-aarch64 | within-baseline | 8.32 MiB | 17.065 ms | 1.05x | 42.057 ms | 26.436 ms | 12.103 ms | 0.89x | 2.017 ms | 0.99x |
| macos-x86_64 | within-baseline | 10.21 MiB | 28.330 ms | 0.84x | 84.237 ms | 52.382 ms | 23.300 ms | 0.90x | 6.419 ms | 0.82x |
| windows-aarch64 | within-baseline | 8.89 MiB | 26.277 ms | 0.92x | 55.576 ms | 36.040 ms | 19.266 ms | 0.93x | 17.578 ms | 0.90x |
| windows-x86_64 | advisory-regression | 10.13 MiB | 24.940 ms | 1.20x | 63.692 ms | 35.394 ms | 22.077 ms | 1.33x | 13.345 ms | 1.36x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
