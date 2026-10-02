# WAsmC public performance

Commit: 58446f7ce50da2cff8e447913d28dbacaa45dae6
Measured: 2026-10-02T16:40:04.267Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.402 ms | 0.99x | 44.228 ms | 24.952 ms | 11.197 ms | 0.98x | 3.704 ms | 0.95x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.810 ms | 1.06x | 44.612 ms | 24.784 ms | 9.234 ms | 1.07x | 2.206 ms | 1.02x |
| macos-aarch64 | within-baseline | 8.48 MiB | 15.190 ms | 0.77x | 34.402 ms | 20.222 ms | 12.390 ms | 0.80x | 1.888 ms | 0.57x |
| macos-x86_64 | within-baseline | 10.39 MiB | 25.610 ms | 0.67x | 67.876 ms | 44.438 ms | 22.221 ms | 0.73x | 5.444 ms | 0.65x |
| windows-aarch64 | within-baseline | 9.07 MiB | 26.797 ms | 0.97x | 55.827 ms | 36.372 ms | 19.252 ms | 0.94x | 17.833 ms | 0.95x |
| windows-x86_64 | within-baseline | 10.32 MiB | 21.485 ms | 1.07x | 57.686 ms | 31.893 ms | 16.677 ms | 1.05x | 10.167 ms | 1.06x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
