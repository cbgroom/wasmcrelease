# WAsmC public performance

Commit: `9c1741ed73c13c2a0e0adb6e3cba31ce5cc6a628`  
Measured: 2026-09-18T14:47:06.992Z  
Platforms: 6  
Canonical corpus: 5

| Platform | CLI | build Wasm gmean p50 | native miss gmean p50 | native hit gmean p50 | run/Wasmi p50 | native run p50 |
|---|---:|---:|---:|---:|---:|---:|
| linux-aarch64 | 9.38 MiB | 14.711 ms | 46.434 ms | 26.168 ms | 11.564 ms | 4.023 ms |
| linux-x86_64 | 11.11 MiB | 10.825 ms | 31.166 ms | 17.572 ms | 7.859 ms | 1.862 ms |
| macos-aarch64 | 8.32 MiB | 25.532 ms | 76.225 ms | 46.594 ms | 21.385 ms | 5.214 ms |
| macos-x86_64 | 10.21 MiB | 38.785 ms | 109.188 ms | 64.303 ms | 31.974 ms | 9.815 ms |
| windows-aarch64 | 8.89 MiB | 24.898 ms | 54.218 ms | 34.520 ms | 17.975 ms | 16.170 ms |
| windows-x86_64 | 10.13 MiB | 16.729 ms | 48.509 ms | 29.177 ms | 13.546 ms | 8.560 ms |

Timings on GitHub-hosted runners are comparative observations, not absolute SLA claims. Corpus identity, generated Wasm identity, and behavior are hard gates.
