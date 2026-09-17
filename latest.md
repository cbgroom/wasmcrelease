# WAsmC public performance

Commit: `007e6a3eb2c9d30db9bdcae1cd0dcc236ee3032f`  
Measured: 2026-09-17T20:48:37.902Z  
Platforms: 6  
Canonical corpus: 5

| Platform | CLI | build Wasm gmean p50 | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | native run p50 |
|---|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | 9.38 MiB | 14.650 ms | 45.583 ms | 25.520 ms | 11.355 ms | 3.937 ms |
| linux-x86_64 | 11.11 MiB | 12.686 ms | 36.838 ms | 20.713 ms | 9.133 ms | 2.316 ms |
| macos-aarch64 | 8.32 MiB | 19.203 ms | 54.799 ms | 36.669 ms | 14.688 ms | 3.908 ms |
| macos-x86_64 | 10.21 MiB | 30.597 ms | 99.979 ms | 57.570 ms | 23.233 ms | 6.376 ms |
| windows-aarch64 | 8.89 MiB | 26.525 ms | 56.315 ms | 36.511 ms | 19.374 ms | 17.735 ms |
| windows-x86_64 | 10.13 MiB | 21.182 ms | 57.282 ms | 31.868 ms | 16.864 ms | 9.713 ms |

Timings on GitHub-hosted runners are comparative observations, not absolute SLA claims. Corpus identity, generated Wasm identity, and behavior are hard gates.
