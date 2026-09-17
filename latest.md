# WAsmC public performance

Commit: `1a7309ad4ecf2b42f220754529c958966cecedb4`  
Measured: 2026-09-17T20:24:16.487Z  
Platforms: 6  
Canonical corpus: 5

| Platform | CLI | build Wasm gmean p50 | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | native run p50 |
|---|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | 9.38 MiB | 14.623 ms | 45.698 ms | 25.826 ms | 11.357 ms | 3.971 ms |
| linux-x86_64 | 11.11 MiB | 12.052 ms | 41.443 ms | 23.839 ms | 8.653 ms | 2.330 ms |
| macos-aarch64 | 8.32 MiB | 22.441 ms | 72.510 ms | 44.305 ms | 24.764 ms | 5.798 ms |
| macos-x86_64 | 10.21 MiB | 28.172 ms | 113.736 ms | 58.880 ms | 23.149 ms | 5.970 ms |
| windows-aarch64 | 8.89 MiB | 25.454 ms | 55.475 ms | 35.431 ms | 18.854 ms | 17.141 ms |
| windows-x86_64 | 10.13 MiB | 25.255 ms | 63.155 ms | 34.074 ms | 20.377 ms | 10.916 ms |

Timings on GitHub-hosted runners are comparative observations, not absolute SLA claims. Corpus identity, generated Wasm identity, and behavior are hard gates.
