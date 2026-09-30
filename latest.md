# WAsmC public performance

Commit: 6334204731334bad44a0a6f540c40f2e9afc081d
Measured: 2026-09-30T15:38:32.745Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 15.608 ms | 1.08x | 47.459 ms | 27.768 ms | 12.132 ms | 1.07x | 4.078 ms | 1.07x |
| linux-x86_64 | within-baseline | 11.30 MiB | 11.184 ms | 0.91x | 32.046 ms | 18.262 ms | 8.351 ms | 0.94x | 1.859 ms | 0.85x |
| macos-aarch64 | within-baseline | 8.48 MiB | 17.203 ms | 0.81x | 36.108 ms | 23.501 ms | 17.145 ms | 0.99x | 2.190 ms | 0.68x |
| macos-x86_64 | within-baseline | 10.39 MiB | 30.282 ms | 1.05x | 77.788 ms | 52.247 ms | 24.174 ms | 1.00x | 6.674 ms | 1.08x |
| windows-aarch64 | within-baseline | 9.07 MiB | 28.035 ms | 1.03x | 58.289 ms | 38.021 ms | 20.324 ms | 1.02x | 18.394 ms | 1.01x |
| windows-x86_64 | within-baseline | 10.32 MiB | 19.800 ms | 0.95x | 54.205 ms | 29.271 ms | 16.353 ms | 0.95x | 9.583 ms | 0.96x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
