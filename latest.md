# WAsmC public performance

Commit: `94cc7643f4b67365093a075ef20a238b1cda35dc`  
Measured: 2026-09-18T15:32:58.534Z  
Platforms: 6  
Canonical corpus: 5

| Platform | CLI | build Wasm gmean p50 | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | native run p50 |
|---|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | 9.38 MiB | 15.304 ms | 47.850 ms | 27.530 ms | 12.092 ms | 4.303 ms |
| linux-x86_64 | 11.11 MiB | 12.541 ms | 42.772 ms | 24.603 ms | 9.693 ms | 2.225 ms |
| macos-aarch64 | 8.32 MiB | 19.834 ms | 50.866 ms | 31.587 ms | 15.086 ms | 3.173 ms |
| macos-x86_64 | 10.21 MiB | 43.922 ms | 118.262 ms | 75.431 ms | 41.205 ms | 12.257 ms |
| windows-aarch64 | 8.89 MiB | 28.172 ms | 57.969 ms | 37.752 ms | 20.389 ms | 18.328 ms |
| windows-x86_64 | 10.13 MiB | 20.568 ms | 56.468 ms | 30.607 ms | 15.944 ms | 9.952 ms |

Timings on GitHub-hosted runners are comparative observations, not absolute SLA claims. Corpus identity, generated Wasm identity, and behavior are hard gates.
