# WAsmC public performance

Commit: `e6be0ba4307d2d2e16ccf4a7675d61ce6f45f3ed`  
Measured: 2026-09-20T16:42:52.013Z  
Platforms: 6  
Canonical corpus: 5

| Platform | CLI | build Wasm gmean p50 | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | native run p50 |
|---|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | 9.38 MiB | 14.796 ms | 45.951 ms | 26.230 ms | 11.514 ms | 3.942 ms |
| linux-x86_64 | 11.11 MiB | 10.080 ms | 30.124 ms | 16.732 ms | 7.128 ms | 1.807 ms |
| macos-aarch64 | 8.32 MiB | 22.482 ms | 60.536 ms | 43.470 ms | 17.666 ms | 3.783 ms |
| macos-x86_64 | 10.21 MiB | 29.750 ms | 73.120 ms | 47.307 ms | 25.429 ms | 6.630 ms |
| windows-aarch64 | 8.89 MiB | 27.804 ms | 57.547 ms | 37.217 ms | 19.708 ms | 18.518 ms |
| windows-x86_64 | 10.13 MiB | 19.610 ms | 52.716 ms | 28.143 ms | 15.867 ms | 9.562 ms |

Timings on GitHub-hosted runners are comparative observations, not absolute SLA claims. Corpus identity, generated Wasm identity, and behavior are hard gates.
