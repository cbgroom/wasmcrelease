# WAsmC external HTTPS load

Commit: 7f54fe1a54f6a52de0887da88747f0c564fb4c73
Measured: 2026-09-29T20:30:53.024Z
Required platforms: linux-x86_64, linux-aarch64, macos-aarch64, windows-x86_64, windows-aarch64

| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |
|---|---|---|---:|---:|---:|---:|---|---:|
| linux-aarch64 | native | health | 1 | 25421.8 | 0.048 | 2.2 | within-baseline | 1.05x |
| linux-aarch64 | wasmc-full | health | 1 | 12027.4 | 0.100 | 1027.6 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-full | post-json | 1 | 9214.4 | 0.125 | 1024.0 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-full | root-json | 1 | 10091.3 | 0.115 | 1030.5 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-tls-native-http | health | 1 | 13159.9 | 0.087 | 1016.9 | within-baseline | 0.98x |
| linux-aarch64 | native | health | 8 | 89681.2 | 0.181 | 2.0 | within-baseline | 1.09x |
| linux-aarch64 | wasmc-full | health | 8 | 24075.4 | 0.744 | 2225.9 | within-baseline | 0.94x |
| linux-aarch64 | wasmc-full | post-json | 8 | 20510.9 | 0.880 | 2263.5 | within-baseline | 0.98x |
| linux-aarch64 | wasmc-full | root-json | 8 | 22360.2 | 0.794 | 2232.0 | within-baseline | 0.98x |
| linux-aarch64 | wasmc-tls-native-http | health | 8 | 29161.5 | 0.628 | 2268.1 | within-baseline | 0.92x |
| linux-aarch64 | native | health | 32 | 105082.1 | 1.564 | 2.1 | advisory-regression | 0.93x |
| linux-aarch64 | wasmc-full | health | 32 | 30966.8 | 2.477 | 9030.0 | within-baseline | 0.95x |
| linux-aarch64 | wasmc-tls-native-http | health | 32 | 38475.5 | 1.953 | 9018.8 | within-baseline | 1.00x |
| linux-x86_64 | native | health | 1 | 22191.4 | 0.064 | 1.8 | within-baseline | 1.59x |
| linux-x86_64 | wasmc-full | health | 1 | 9032.9 | 0.146 | 1260.1 | within-baseline | 1.37x |
| linux-x86_64 | wasmc-full | post-json | 1 | 7370.1 | 0.166 | 1251.4 | within-baseline | 1.31x |
| linux-x86_64 | wasmc-full | root-json | 1 | 8088.3 | 0.155 | 1264.2 | within-baseline | 1.34x |
| linux-x86_64 | wasmc-tls-native-http | health | 1 | 10075.4 | 0.131 | 1255.4 | within-baseline | 1.39x |
| linux-x86_64 | native | health | 8 | 105983.4 | 0.089 | 1.8 | within-baseline | 1.60x |
| linux-x86_64 | wasmc-full | health | 8 | 27702.1 | 0.548 | 4023.8 | within-baseline | 1.31x |
| linux-x86_64 | wasmc-full | post-json | 8 | 21082.1 | 0.731 | 4078.1 | within-baseline | 1.26x |
| linux-x86_64 | wasmc-full | root-json | 8 | 23214.9 | 0.683 | 4016.7 | within-baseline | 1.25x |
| linux-x86_64 | wasmc-tls-native-http | health | 8 | 32714.7 | 0.468 | 4041.5 | within-baseline | 1.36x |
| linux-x86_64 | native | health | 32 | 118339.3 | 0.375 | 1.7 | within-baseline | 1.53x |
| linux-x86_64 | wasmc-full | health | 32 | 28279.2 | 2.201 | 16551.5 | within-baseline | 1.28x |
| linux-x86_64 | wasmc-tls-native-http | health | 32 | 33367.3 | 1.862 | 16517.1 | within-baseline | 1.32x |
| macos-aarch64 | native | health | 1 | 10058.6 | 0.285 | 6.3 | advisory-regression | 1.03x |
| macos-aarch64 | wasmc-full | health | 1 | 7274.7 | 0.453 | 1060.8 | advisory-regression | 1.02x |
| macos-aarch64 | wasmc-full | post-json | 1 | 6329.6 | 0.503 | 1027.4 | advisory-regression | 1.05x |
| macos-aarch64 | wasmc-full | root-json | 1 | 7115.9 | 0.411 | 1004.1 | advisory-regression | 1.01x |
| macos-aarch64 | wasmc-tls-native-http | health | 1 | 6032.4 | 0.303 | 983.2 | advisory-regression | 0.80x |
| macos-aarch64 | native | health | 8 | 47354.6 | 0.536 | 3.7 | within-baseline | 0.93x |
| macos-aarch64 | wasmc-full | health | 8 | 22227.3 | 2.199 | 3281.4 | advisory-regression | 1.10x |
| macos-aarch64 | wasmc-full | post-json | 8 | 19745.9 | 3.784 | 2815.3 | advisory-regression | 1.09x |
| macos-aarch64 | wasmc-full | root-json | 8 | 14694.7 | 3.382 | 2553.7 | advisory-regression | 0.79x |
| macos-aarch64 | wasmc-tls-native-http | health | 8 | 20678.7 | 1.438 | 2624.0 | within-baseline | 0.88x |
| macos-aarch64 | native | health | 32 | 67618.6 | 2.400 | 4.2 | within-baseline | 0.96x |
| macos-aarch64 | wasmc-full | health | 32 | 21756.6 | 14.060 | 11614.8 | within-baseline | 0.93x |
| macos-aarch64 | wasmc-tls-native-http | health | 32 | 19205.4 | 12.044 | 12531.8 | advisory-regression | 0.78x |
| macos-x86_64 | native | health | 1 | 2682.5 | 0.330 | 5.1 | within-baseline | 1.19x |
| macos-x86_64 | wasmc-full | health | 1 | 1578.9 | 0.555 | 1540.8 | within-baseline | 1.07x |
| macos-x86_64 | wasmc-full | post-json | 1 | 1627.1 | 0.857 | 1625.7 | within-baseline | 1.16x |
| macos-x86_64 | wasmc-full | root-json | 1 | 1675.4 | 1.111 | 1572.9 | advisory-regression | 1.30x |
| macos-x86_64 | wasmc-tls-native-http | health | 1 | 947.7 | 0.927 | 1585.0 | advisory-regression | 0.64x |
| macos-x86_64 | native | health | 8 | 15377.8 | 0.886 | 6.0 | within-baseline | 1.42x |
| macos-x86_64 | wasmc-full | health | 8 | 5549.2 | 6.283 | 5243.9 | within-baseline | 1.04x |
| macos-x86_64 | wasmc-full | post-json | 8 | 5463.8 | 7.351 | 4727.6 | within-baseline | 1.08x |
| macos-x86_64 | wasmc-full | root-json | 8 | 4971.0 | 10.261 | 5051.3 | advisory-regression | 0.85x |
| macos-x86_64 | wasmc-tls-native-http | health | 8 | 6936.5 | 3.846 | 5744.4 | within-baseline | 1.41x |
| macos-x86_64 | native | health | 32 | 24723.2 | 5.506 | 5.1 | within-baseline | 1.05x |
| macos-x86_64 | wasmc-full | health | 32 | 6550.2 | 125.432 | 20731.8 | within-baseline | 0.95x |
| macos-x86_64 | wasmc-tls-native-http | health | 32 | 7837.6 | 125.539 | 20291.3 | within-baseline | 1.33x |
| windows-aarch64 | native | health | 1 | 8756.0 | 0.151 | 10.8 | within-baseline | 1.02x |
| windows-aarch64 | wasmc-full | health | 1 | 4369.3 | 0.255 | 1136.0 | within-baseline | 1.00x |
| windows-aarch64 | wasmc-full | post-json | 1 | 3890.9 | 0.289 | 1123.1 | within-baseline | 0.98x |
| windows-aarch64 | wasmc-full | root-json | 1 | 4001.5 | 0.279 | 1137.8 | within-baseline | 0.99x |
| windows-aarch64 | wasmc-tls-native-http | health | 1 | 4971.6 | 0.226 | 1130.2 | within-baseline | 1.02x |
| windows-aarch64 | native | health | 8 | 32486.9 | 0.707 | 10.5 | within-baseline | 1.01x |
| windows-aarch64 | wasmc-full | health | 8 | 13992.8 | 5.053 | 2497.0 | within-baseline | 1.04x |
| windows-aarch64 | wasmc-full | post-json | 8 | 12143.3 | 6.740 | 2420.8 | within-baseline | 1.01x |
| windows-aarch64 | wasmc-full | root-json | 8 | 13079.6 | 6.999 | 2437.9 | within-baseline | 1.08x |
| windows-aarch64 | wasmc-tls-native-http | health | 8 | 15128.5 | 4.863 | 2484.4 | advisory-regression | 0.98x |
| windows-aarch64 | native | health | 32 | 36455.3 | 1.714 | 11.0 | within-baseline | 0.99x |
| windows-aarch64 | wasmc-full | health | 32 | 14811.4 | 28.729 | 9801.5 | within-baseline | 0.99x |
| windows-aarch64 | wasmc-tls-native-http | health | 32 | 17278.3 | 15.581 | 10218.1 | within-baseline | 1.09x |
| windows-x86_64 | native | health | 1 | 17473.2 | 0.084 | 9.4 | within-baseline | 1.35x |
| windows-x86_64 | wasmc-full | health | 1 | 7737.8 | 0.181 | 1461.8 | within-baseline | 1.28x |
| windows-x86_64 | wasmc-full | post-json | 1 | 6768.7 | 0.205 | 1446.4 | within-baseline | 1.37x |
| windows-x86_64 | wasmc-full | root-json | 1 | 7213.2 | 0.195 | 1447.3 | within-baseline | 1.36x |
| windows-x86_64 | wasmc-tls-native-http | health | 1 | 8454.7 | 0.169 | 1463.5 | within-baseline | 1.27x |
| windows-x86_64 | native | health | 8 | 50844.4 | 0.290 | 9.3 | within-baseline | 1.68x |
| windows-x86_64 | wasmc-full | health | 8 | 13810.4 | 3.809 | 4471.6 | within-baseline | 1.02x |
| windows-x86_64 | wasmc-full | post-json | 8 | 15916.0 | 4.655 | 4423.3 | within-baseline | 1.49x |
| windows-x86_64 | wasmc-full | root-json | 8 | 16660.2 | 3.716 | 4417.0 | within-baseline | 1.36x |
| windows-x86_64 | wasmc-tls-native-http | health | 8 | 20596.0 | 2.117 | 4432.0 | within-baseline | 1.40x |
| windows-x86_64 | native | health | 32 | 53607.6 | 0.848 | 9.6 | within-baseline | 1.58x |
| windows-x86_64 | wasmc-full | health | 32 | 20652.3 | 7.254 | 17394.0 | within-baseline | 1.47x |
| windows-x86_64 | wasmc-tls-native-http | health | 32 | 23178.5 | 6.359 | 17454.6 | advisory-regression | 1.67x |

External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.
