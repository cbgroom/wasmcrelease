# WAsmC public performance

Commit: 62dcc64f7c67a4efd4ed68a1a582571774e948d3
Measured: 2026-09-30T16:31:05.880Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 15.652 ms | 1.11x | 48.092 ms | 27.682 ms | 12.311 ms | 1.11x | 4.406 ms | 1.16x |
| linux-x86_64 | within-baseline | 11.30 MiB | 10.333 ms | 0.83x | 31.258 ms | 17.307 ms | 7.471 ms | 0.82x | 1.872 ms | 0.86x |
| macos-aarch64 | within-baseline | 8.48 MiB | 18.416 ms | 0.92x | 49.194 ms | 27.053 ms | 14.729 ms | 0.85x | 3.477 ms | 0.98x |
| macos-x86_64 | within-baseline | 10.39 MiB | 38.451 ms | 1.11x | 96.651 ms | 61.201 ms | 31.901 ms | 1.02x | 8.581 ms | 0.94x |
| windows-aarch64 | within-baseline | 9.07 MiB | 28.627 ms | 1.05x | 59.038 ms | 38.650 ms | 21.069 ms | 1.05x | 18.976 ms | 1.04x |
| windows-x86_64 | within-baseline | 10.32 MiB | 22.079 ms | 1.03x | 58.160 ms | 31.687 ms | 17.802 ms | 1.03x | 10.170 ms | 1.07x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
