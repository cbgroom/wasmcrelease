# WAsmC public performance

Commit: `22b743d9ce11f55420d5125201b67800ad3c5523`  
Measured: 2026-09-18T17:25:42.290Z  
Platforms: 6  
Canonical corpus: 5

| Platform | CLI | build Wasm gmean p50 | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | native run p50 |
|---|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | 9.38 MiB | 13.425 ms | 42.511 ms | 22.940 ms | 10.475 ms | 3.509 ms |
| linux-x86_64 | 11.11 MiB | 9.860 ms | 33.967 ms | 19.254 ms | 6.719 ms | 1.799 ms |
| macos-aarch64 | 8.32 MiB | 24.577 ms | 62.825 ms | 40.055 ms | 29.631 ms | 6.798 ms |
| macos-x86_64 | 10.21 MiB | 39.473 ms | 96.092 ms | 63.231 ms | 34.439 ms | 10.104 ms |
| windows-aarch64 | 8.89 MiB | 27.543 ms | 57.151 ms | 37.410 ms | 19.919 ms | 18.301 ms |
| windows-x86_64 | 10.13 MiB | 21.939 ms | 56.718 ms | 31.833 ms | 17.046 ms | 9.591 ms |

Timings on GitHub-hosted runners are comparative observations, not absolute SLA claims. Corpus identity, generated Wasm identity, and behavior are hard gates.
