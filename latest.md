# WAsmC public performance

Commit: `0ba99c613a8497a78b8ef2a002273914f01f82e9`  
Measured: 2026-09-20T16:25:55.125Z  
Platforms: 6  
Canonical corpus: 5

| Platform | CLI | build Wasm gmean p50 | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | native run p50 |
|---|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | 9.38 MiB | 14.253 ms | 44.526 ms | 24.606 ms | 11.103 ms | 3.779 ms |
| linux-x86_64 | 11.11 MiB | 12.981 ms | 38.548 ms | 20.869 ms | 9.364 ms | 2.375 ms |
| macos-aarch64 | 8.32 MiB | 22.596 ms | 62.483 ms | 44.980 ms | 18.171 ms | 3.399 ms |
| macos-x86_64 | 10.21 MiB | 34.144 ms | 98.068 ms | 58.494 ms | 34.564 ms | 8.449 ms |
| windows-aarch64 | 8.89 MiB | 25.383 ms | 54.612 ms | 34.983 ms | 18.090 ms | 16.745 ms |
| windows-x86_64 | 10.13 MiB | 20.613 ms | 58.418 ms | 35.126 ms | 16.305 ms | 10.264 ms |

Timings on GitHub-hosted runners are comparative observations, not absolute SLA claims. Corpus identity, generated Wasm identity, and behavior are hard gates.
