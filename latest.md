# WAsmC public performance

Commit: `f81b598f11198e0d801ec21dd95d585ff495953b`  
Measured: 2026-09-20T17:23:57.291Z  
Platforms: 6  
Canonical corpus: 5

| Platform | CLI | build Wasm gmean p50 | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | native run p50 |
|---|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | 9.38 MiB | 13.733 ms | 43.028 ms | 23.236 ms | 10.767 ms | 3.622 ms |
| linux-x86_64 | 11.11 MiB | 11.679 ms | 40.771 ms | 23.352 ms | 9.811 ms | 2.136 ms |
| macos-aarch64 | 8.32 MiB | 17.966 ms | 46.990 ms | 31.473 ms | 15.510 ms | 2.469 ms |
| macos-x86_64 | 10.21 MiB | 48.161 ms | 121.866 ms | 79.468 ms | 43.553 ms | 12.593 ms |
| windows-aarch64 | 8.89 MiB | 26.335 ms | 55.494 ms | 35.819 ms | 18.636 ms | 17.667 ms |
| windows-x86_64 | 10.13 MiB | 21.309 ms | 62.045 ms | 36.784 ms | 16.535 ms | 10.296 ms |

Timings on GitHub-hosted runners are comparative observations, not absolute SLA claims. Corpus identity, generated Wasm identity, and behavior are hard gates.
