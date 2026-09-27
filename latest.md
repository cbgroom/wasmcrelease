# WAsmC public performance

Commit: c0c95f8c62c2d413a6dd28f9c46203409dc15b13
Measured: 2026-09-27T01:57:55.517Z
Platforms: 6
Canonical corpus: 5

| Platform | Baseline | CLI | build Wasm gmean p50 | build/base | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | run/base | native run p50 | native/base |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | within-baseline | 9.38 MiB | 15.336 ms | 1.09x | 47.455 ms | 26.929 ms | 11.958 ms | 1.11x | 4.320 ms | 1.16x |
| linux-x86_64 | within-baseline | 11.11 MiB | 7.965 ms | 0.68x | 27.869 ms | 15.484 ms | 5.745 ms | 0.64x | 1.636 ms | 0.76x |
| macos-aarch64 | within-baseline | 8.32 MiB | 14.649 ms | 0.77x | 33.649 ms | 20.636 ms | 13.883 ms | 0.90x | 1.904 ms | 0.57x |
| macos-x86_64 | within-baseline | 10.21 MiB | 28.910 ms | 0.80x | 73.591 ms | 47.980 ms | 22.550 ms | 0.79x | 6.278 ms | 0.80x |
| windows-aarch64 | within-baseline | 8.89 MiB | 27.612 ms | 0.99x | 57.670 ms | 37.334 ms | 20.347 ms | 1.02x | 18.845 ms | 0.98x |
| windows-x86_64 | advisory-regression | 10.13 MiB | 20.376 ms | 1.26x | 53.724 ms | 29.678 ms | 16.080 ms | 1.21x | 9.604 ms | 1.24x |

GitHub-hosted timings are same-platform comparative observations, not absolute cross-platform SLA claims.
Ratios are current / rolling same-platform median; >1.0 is slower for latency metrics.
Corpus identity, generated Wasm identity, and behavior are hard gates. Performance regression state is advisory under the current policy.
