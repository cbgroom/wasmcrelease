# WAsmC public performance

Commit: d131f57b5e473e466f59cec3570aefe218e68167
Measured: 2026-10-02T08:09:32.946Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 15.046 ms | 0.98x | 46.538 ms | 26.585 ms | 12.168 ms | 1.01x | 4.160 ms | 1.00x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.911 ms | 1.05x | 44.373 ms | 24.709 ms | 9.317 ms | 1.05x | 2.360 ms | 1.08x |
| macos-aarch64 | within-baseline | 8.48 MiB | 14.486 ms | 0.72x | 32.247 ms | 19.353 ms | 12.012 ms | 0.63x | 1.767 ms | 0.48x |
| macos-x86_64 | within-baseline | 10.39 MiB | 26.475 ms | 0.82x | 78.813 ms | 46.240 ms | 24.956 ms | 0.91x | 5.479 ms | 0.64x |
| windows-aarch64 | within-baseline | 9.07 MiB | 27.738 ms | 1.00x | 57.659 ms | 37.722 ms | 20.355 ms | 1.00x | 18.165 ms | 0.99x |
| windows-x86_64 | within-baseline | 10.32 MiB | 20.166 ms | 0.93x | 54.533 ms | 30.176 ms | 15.891 ms | 0.91x | 9.590 ms | 0.89x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
