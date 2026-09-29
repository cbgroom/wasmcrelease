# WAsmC public performance

Commit: c49bfcd5971fdd3780303b61378e5a1f2502a45d
Measured: 2026-09-29T21:06:48.688Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.57 MiB | 14.011 ms | 0.94x | 44.332 ms | 23.891 ms | 11.021 ms | 0.95x | 3.798 ms | 0.95x |
| linux-x86_64 | within-baseline | 11.30 MiB | 8.026 ms | 0.65x | 27.505 ms | 16.983 ms | 5.357 ms | 0.59x | 1.647 ms | 0.75x |
| macos-aarch64 | advisory-regression | 8.48 MiB | 21.297 ms | 0.94x | 57.410 ms | 33.249 ms | 20.188 ms | 1.17x | 5.149 ms | 1.61x |
| macos-x86_64 | advisory-regression | 10.39 MiB | 38.667 ms | 1.34x | 117.228 ms | 63.206 ms | 31.246 ms | 1.29x | 9.735 ms | 1.58x |
| windows-aarch64 | within-baseline | 9.07 MiB | 26.908 ms | 0.98x | 56.161 ms | 36.766 ms | 19.492 ms | 0.96x | 17.636 ms | 0.94x |
| windows-x86_64 | within-baseline | 10.32 MiB | 14.496 ms | 0.69x | 38.191 ms | 23.713 ms | 11.870 ms | 0.69x | 6.893 ms | 0.69x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
