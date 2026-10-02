# WAsmC public performance

Commit: dd30f28276a633cefb68972186c2cbeb2fca4a80
Measured: 2026-10-02T09:43:11.259Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.808 ms | 1.03x | 46.481 ms | 25.840 ms | 11.607 ms | 1.02x | 3.931 ms | 1.03x |
| linux-x86_64 | within-baseline | 11.30 MiB | 12.698 ms | 1.17x | 43.238 ms | 23.912 ms | 8.857 ms | 1.14x | 2.167 ms | 1.18x |
| macos-aarch64 | within-baseline | 8.48 MiB | 21.746 ms | 1.10x | 50.788 ms | 32.363 ms | 13.085 ms | 0.77x | 3.304 ms | 0.98x |
| macos-x86_64 | within-baseline | 10.39 MiB | 35.938 ms | 0.94x | 86.596 ms | 57.430 ms | 29.411 ms | 0.96x | 8.360 ms | 0.84x |
| windows-aarch64 | within-baseline | 9.07 MiB | 27.941 ms | 1.01x | 57.432 ms | 37.702 ms | 20.340 ms | 1.00x | 19.869 ms | 1.07x |
| windows-x86_64 | within-baseline | 10.32 MiB | 22.721 ms | 1.13x | 56.749 ms | 30.848 ms | 17.608 ms | 1.11x | 10.220 ms | 1.07x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
