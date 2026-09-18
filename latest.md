# WAsmC public performance

Commit: `c23a51d748412be35e86976d352d6e511f96280e`  
Measured: 2026-09-18T03:14:48.618Z  
Platforms: 6  
Canonical corpus: 5

| Platform | CLI | build Wasm gmean p50 | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | native run p50 |
|---|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | 9.38 MiB | 13.639 ms | 42.489 ms | 22.995 ms | 10.713 ms | 3.693 ms |
| linux-x86_64 | 11.11 MiB | 11.983 ms | 42.939 ms | 25.567 ms | 8.573 ms | 2.637 ms |
| macos-aarch64 | 8.32 MiB | 16.918 ms | 40.389 ms | 24.410 ms | 14.360 ms | 2.934 ms |
| macos-x86_64 | 10.21 MiB | 36.768 ms | 87.237 ms | 56.023 ms | 29.239 ms | 8.066 ms |
| windows-aarch64 | 8.89 MiB | 24.979 ms | 54.739 ms | 34.780 ms | 18.020 ms | 16.556 ms |
| windows-x86_64 | 10.13 MiB | 20.959 ms | 54.510 ms | 29.212 ms | 16.115 ms | 9.746 ms |

Timings on GitHub-hosted runners are comparative observations, not absolute SLA claims. Corpus identity, generated Wasm identity, and behavior are hard gates.
