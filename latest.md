# WAsmC external HTTPS load

Commit: c0c95f8c62c2d413a6dd28f9c46203409dc15b13
Measured: 2026-09-27T02:08:49.660Z
Required platforms: linux-x86_64, linux-aarch64, macos-aarch64, windows-x86_64, windows-aarch64

| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |
|---|---|---|---:|---:|---:|---:|---|---:|
| linux-aarch64 | native | health | 1 | 22359.8 | 0.053 | 2.3 | within-baseline | 0.92x |
| linux-aarch64 | wasmc-full | health | 1 | 11038.1 | 0.107 | 1044.0 | within-baseline | 0.90x |
| linux-aarch64 | wasmc-full | post-json | 1 | 8780.1 | 0.129 | 1041.9 | within-baseline | 0.94x |
| linux-aarch64 | wasmc-full | root-json | 1 | 9931.7 | 0.114 | 1040.9 | within-baseline | 0.93x |
| linux-aarch64 | wasmc-tls-native-http | health | 1 | 12679.7 | 0.092 | 1048.4 | within-baseline | 0.94x |
| linux-aarch64 | native | health | 8 | 81033.2 | 0.158 | 2.2 | within-baseline | 0.94x |
| linux-aarch64 | wasmc-full | health | 8 | 24591.5 | 0.716 | 2375.0 | within-baseline | 0.90x |
| linux-aarch64 | wasmc-full | post-json | 8 | 19647.6 | 1.042 | 2398.6 | within-baseline | 0.91x |
| linux-aarch64 | wasmc-full | root-json | 8 | 20991.0 | 0.846 | 2408.3 | within-baseline | 0.91x |
| linux-aarch64 | wasmc-tls-native-http | health | 8 | 29892.6 | 0.813 | 2365.7 | advisory-regression | 0.92x |
| linux-aarch64 | native | health | 32 | 107706.0 | 1.292 | 2.2 | advisory-regression | 0.94x |
| linux-aarch64 | wasmc-full | health | 32 | 30363.2 | 2.348 | 9462.6 | within-baseline | 0.91x |
| linux-aarch64 | wasmc-tls-native-http | health | 32 | 37969.5 | 1.759 | 9413.9 | within-baseline | 0.91x |
| linux-x86_64 | native | health | 1 | 13929.8 | 0.087 | 2.1 | advisory-regression | 0.68x |
| linux-x86_64 | wasmc-full | health | 1 | 6691.3 | 0.165 | 1343.7 | advisory-regression | 0.75x |
| linux-x86_64 | wasmc-full | post-json | 1 | 5494.5 | 0.205 | 1354.1 | advisory-regression | 0.77x |
| linux-x86_64 | wasmc-full | root-json | 1 | 6034.3 | 0.184 | 1346.3 | advisory-regression | 0.75x |
| linux-x86_64 | wasmc-tls-native-http | health | 1 | 7435.2 | 0.151 | 1349.2 | advisory-regression | 0.75x |
| linux-x86_64 | native | health | 8 | 66863.0 | 0.164 | 2.0 | within-baseline | 0.80x |
| linux-x86_64 | wasmc-full | health | 8 | 20672.2 | 0.696 | 4075.2 | within-baseline | 0.86x |
| linux-x86_64 | wasmc-full | post-json | 8 | 16291.5 | 0.946 | 4103.1 | within-baseline | 0.87x |
| linux-x86_64 | wasmc-full | root-json | 8 | 18902.4 | 0.796 | 4073.7 | within-baseline | 0.90x |
| linux-x86_64 | wasmc-tls-native-http | health | 8 | 23991.5 | 0.628 | 4129.0 | within-baseline | 0.83x |
| linux-x86_64 | native | health | 32 | 75938.4 | 0.603 | 2.0 | within-baseline | 0.83x |
| linux-x86_64 | wasmc-full | health | 32 | 22635.9 | 2.754 | 16488.6 | within-baseline | 0.91x |
| linux-x86_64 | wasmc-tls-native-http | health | 32 | 25890.4 | 2.408 | 16636.3 | within-baseline | 0.92x |
| macos-aarch64 | native | health | 1 | 15073.6 | 0.135 | 5.9 | within-baseline | 1.19x |
| macos-aarch64 | wasmc-full | health | 1 | 6465.3 | 0.229 | 856.3 | advisory-regression | 0.73x |
| macos-aarch64 | wasmc-full | post-json | 1 | 5184.9 | 0.291 | 797.0 | advisory-regression | 0.77x |
| macos-aarch64 | wasmc-full | root-json | 1 | 5797.0 | 0.237 | 798.3 | advisory-regression | 0.74x |
| macos-aarch64 | wasmc-tls-native-http | health | 1 | 8661.2 | 0.240 | 821.5 | within-baseline | 0.88x |
| macos-aarch64 | native | health | 8 | 50661.4 | 0.464 | 3.8 | within-baseline | 0.97x |
| macos-aarch64 | wasmc-full | health | 8 | 24114.5 | 1.843 | 2284.1 | within-baseline | 0.83x |
| macos-aarch64 | wasmc-full | post-json | 8 | 20884.9 | 2.098 | 2499.5 | within-baseline | 0.97x |
| macos-aarch64 | wasmc-full | root-json | 8 | 15953.7 | 3.147 | 2265.4 | advisory-regression | 0.65x |
| macos-aarch64 | wasmc-tls-native-http | health | 8 | 22553.4 | 1.563 | 2557.1 | within-baseline | 0.91x |
| macos-aarch64 | native | health | 32 | 76354.8 | 2.093 | 4.1 | within-baseline | 0.96x |
| macos-aarch64 | wasmc-full | health | 32 | 26623.5 | 10.416 | 9878.6 | within-baseline | 0.87x |
| macos-aarch64 | wasmc-tls-native-http | health | 32 | 24622.4 | 8.950 | 10291.1 | within-baseline | 0.91x |
| macos-x86_64 | native | health | 1 | 2996.2 | 0.349 | 4.8 | within-baseline | 0.94x |
| macos-x86_64 | wasmc-full | health | 1 | 1935.4 | 0.547 | 1568.6 | within-baseline | 0.86x |
| macos-x86_64 | wasmc-full | post-json | 1 | 1150.5 | 1.262 | 1574.2 | advisory-regression | 0.63x |
| macos-x86_64 | wasmc-full | root-json | 1 | 1659.7 | 0.822 | 1561.3 | advisory-regression | 0.75x |
| macos-x86_64 | wasmc-tls-native-http | health | 1 | 1856.3 | 0.647 | 1562.6 | advisory-regression | 0.77x |
| macos-x86_64 | native | health | 8 | 12165.4 | 1.556 | 5.5 | within-baseline | 0.84x |
| macos-x86_64 | wasmc-full | health | 8 | 6294.8 | 6.415 | 3922.2 | advisory-regression | 0.67x |
| macos-x86_64 | wasmc-full | post-json | 8 | 7987.9 | 4.740 | 4037.9 | within-baseline | 1.04x |
| macos-x86_64 | wasmc-full | root-json | 8 | 7684.6 | 5.179 | 4066.7 | within-baseline | 1.25x |
| macos-x86_64 | wasmc-tls-native-http | health | 8 | 8384.6 | 3.908 | 4465.1 | within-baseline | 0.91x |
| macos-x86_64 | native | health | 32 | 30413.3 | 3.975 | 5.0 | within-baseline | 0.93x |
| macos-x86_64 | wasmc-full | health | 32 | 7113.2 | 125.938 | 16802.8 | within-baseline | 0.82x |
| macos-x86_64 | wasmc-tls-native-http | health | 32 | 7647.6 | 76.288 | 17230.4 | within-baseline | 0.84x |
| windows-aarch64 | native | health | 1 | 8464.9 | 0.136 | 11.3 | within-baseline | 0.96x |
| windows-aarch64 | wasmc-full | health | 1 | 4389.1 | 0.257 | 1136.7 | within-baseline | 0.94x |
| windows-aarch64 | wasmc-full | post-json | 1 | 3909.4 | 0.288 | 1162.9 | within-baseline | 0.93x |
| windows-aarch64 | wasmc-full | root-json | 1 | 4045.5 | 0.275 | 1155.8 | within-baseline | 0.98x |
| windows-aarch64 | wasmc-tls-native-http | health | 1 | 4886.2 | 0.216 | 1158.8 | within-baseline | 0.95x |
| windows-aarch64 | native | health | 8 | 30393.8 | 0.760 | 10.7 | within-baseline | 0.93x |
| windows-aarch64 | wasmc-full | health | 8 | 13387.2 | 7.517 | 2499.9 | advisory-regression | 0.93x |
| windows-aarch64 | wasmc-full | post-json | 8 | 12060.6 | 5.468 | 2530.1 | within-baseline | 0.95x |
| windows-aarch64 | wasmc-full | root-json | 8 | 12288.8 | 6.662 | 2511.5 | within-baseline | 0.92x |
| windows-aarch64 | wasmc-tls-native-http | health | 8 | 13845.5 | 3.872 | 2537.4 | within-baseline | 0.89x |
| windows-aarch64 | native | health | 32 | 36978.0 | 1.695 | 11.4 | within-baseline | 0.96x |
| windows-aarch64 | wasmc-full | health | 32 | 12605.9 | 23.316 | 10175.9 | within-baseline | 0.83x |
| windows-aarch64 | wasmc-tls-native-http | health | 32 | 15817.4 | 19.743 | 10245.4 | within-baseline | 0.89x |
| windows-x86_64 | native | health | 1 | 12733.0 | 0.116 | 8.9 | within-baseline | 0.96x |
| windows-x86_64 | wasmc-full | health | 1 | 6024.7 | 0.234 | 1560.7 | within-baseline | 0.98x |
| windows-x86_64 | wasmc-full | post-json | 1 | 4925.9 | 0.273 | 1547.6 | within-baseline | 0.96x |
| windows-x86_64 | wasmc-full | root-json | 1 | 5300.5 | 0.252 | 1549.5 | within-baseline | 0.98x |
| windows-x86_64 | wasmc-tls-native-http | health | 1 | 6430.5 | 0.213 | 1545.7 | within-baseline | 0.96x |
| windows-x86_64 | native | health | 8 | 30214.2 | 0.427 | 9.5 | within-baseline | 0.98x |
| windows-x86_64 | wasmc-full | health | 8 | 13103.5 | 5.485 | 4638.2 | within-baseline | 0.96x |
| windows-x86_64 | wasmc-full | post-json | 8 | 10628.7 | 5.815 | 4651.5 | within-baseline | 0.91x |
| windows-x86_64 | wasmc-full | root-json | 8 | 12244.6 | 5.666 | 4605.6 | within-baseline | 1.04x |
| windows-x86_64 | wasmc-tls-native-http | health | 8 | 15302.1 | 3.764 | 4626.5 | within-baseline | 1.01x |
| windows-x86_64 | native | health | 32 | 34275.3 | 1.220 | 8.9 | within-baseline | 0.98x |
| windows-x86_64 | wasmc-full | health | 32 | 14362.7 | 11.718 | 18322.4 | advisory-regression | 0.99x |
| windows-x86_64 | wasmc-tls-native-http | health | 32 | 13850.4 | 3.479 | 18141.0 | within-baseline | 0.95x |

External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.
