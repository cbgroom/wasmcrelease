# WAsmC public performance

Commit: 0faacac367d40f31e386291283bfd78cac62c286
Measured: 2026-09-30T16:18:36.146Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 15.636 ms | 1.11x | 48.400 ms | 27.917 ms | 12.303 ms | 1.11x | 4.193 ms | 1.10x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.887 ms | 1.04x | 43.159 ms | 24.962 ms | 9.293 ms | 1.04x | 2.181 ms | 1.00x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 19.926 ms | 1.03x | 53.771 ms | 31.753 ms | 16.737 ms | 0.97x | 3.715 ms | 1.16x |
| macos-x86_64 | within-baseline | 10.39 MiB | 26.563 ms | 0.77x | 66.299 ms | 44.555 ms | 23.152 ms | 0.74x | 7.142 ms | 0.78x |
| windows-aarch64 | within-baseline | 9.07 MiB | 27.205 ms | 0.99x | 56.634 ms | 36.859 ms | 19.968 ms | 1.00x | 17.721 ms | 0.96x |
| windows-x86_64 | within-baseline | 10.32 MiB | 21.440 ms | 1.03x | 60.031 ms | 35.430 ms | 17.423 ms | 1.01x | 10.816 ms | 1.14x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
