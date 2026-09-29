# WAsmC external HTTPS load

Commit: f707b47985590fabf48da312b5ecf347e20b150b
Measured: 2026-09-29T09:36:03.729Z
Required platforms: linux-x86_64, linux-aarch64, macos-aarch64, windows-x86_64, windows-aarch64

| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |
|---|---|---|---:|---:|---:|---:|---|---:|
| linux-aarch64 | native | health | 1 | 25225.0 | 0.046 | 1.9 | within-baseline | 1.04x |
| linux-aarch64 | wasmc-full | health | 1 | 12253.8 | 0.097 | 1013.5 | within-baseline | 1.02x |
| linux-aarch64 | wasmc-full | post-json | 1 | 9832.3 | 0.120 | 1029.8 | within-baseline | 1.06x |
| linux-aarch64 | wasmc-full | root-json | 1 | 10353.1 | 0.111 | 1031.0 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-tls-native-http | health | 1 | 14038.3 | 0.083 | 1013.9 | within-baseline | 1.06x |
| linux-aarch64 | native | health | 8 | 88060.5 | 0.191 | 1.9 | within-baseline | 1.04x |
| linux-aarch64 | wasmc-full | health | 8 | 25632.4 | 0.743 | 2176.2 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-full | post-json | 8 | 20757.6 | 0.904 | 2244.6 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-full | root-json | 8 | 22713.5 | 0.732 | 2230.6 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-tls-native-http | health | 8 | 31188.3 | 0.620 | 2293.2 | within-baseline | 0.96x |
| linux-aarch64 | native | health | 32 | 113512.5 | 0.942 | 1.8 | within-baseline | 1.01x |
| linux-aarch64 | wasmc-full | health | 32 | 32825.7 | 2.257 | 8890.0 | within-baseline | 1.01x |
| linux-aarch64 | wasmc-tls-native-http | health | 32 | 40029.2 | 1.823 | 8714.3 | within-baseline | 1.04x |
| linux-x86_64 | native | health | 1 | 14017.1 | 0.085 | 2.1 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-full | health | 1 | 6448.0 | 0.228 | 1360.4 | advisory-regression | 0.96x |
| linux-x86_64 | wasmc-full | post-json | 1 | 5676.6 | 0.201 | 1364.5 | within-baseline | 1.00x |
| linux-x86_64 | wasmc-full | root-json | 1 | 6100.3 | 0.182 | 1380.1 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-tls-native-http | health | 1 | 7262.6 | 0.154 | 1371.8 | within-baseline | 0.99x |
| linux-x86_64 | native | health | 8 | 66087.7 | 0.167 | 2.2 | within-baseline | 0.99x |
| linux-x86_64 | wasmc-full | health | 8 | 21262.6 | 0.693 | 4126.6 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-full | post-json | 8 | 16716.6 | 0.917 | 4115.9 | within-baseline | 0.99x |
| linux-x86_64 | wasmc-full | root-json | 8 | 18603.9 | 0.788 | 4116.2 | within-baseline | 1.00x |
| linux-x86_64 | wasmc-tls-native-http | health | 8 | 24384.0 | 0.620 | 4144.4 | within-baseline | 1.02x |
| linux-x86_64 | native | health | 32 | 76497.6 | 0.638 | 2.0 | within-baseline | 0.99x |
| linux-x86_64 | wasmc-full | health | 32 | 22040.7 | 2.869 | 16897.8 | within-baseline | 0.97x |
| linux-x86_64 | wasmc-tls-native-http | health | 32 | 25764.6 | 2.439 | 17057.6 | within-baseline | 1.01x |
| macos-aarch64 | native | health | 1 | 9744.1 | 0.180 | 7.8 | advisory-regression | 0.82x |
| macos-aarch64 | wasmc-full | health | 1 | 8787.6 | 0.264 | 916.4 | advisory-regression | 1.23x |
| macos-aarch64 | wasmc-full | post-json | 1 | 6969.1 | 0.338 | 1001.1 | within-baseline | 1.19x |
| macos-aarch64 | wasmc-full | root-json | 1 | 7027.0 | 0.358 | 849.2 | advisory-regression | 0.97x |
| macos-aarch64 | wasmc-tls-native-http | health | 1 | 7550.0 | 0.270 | 1042.1 | within-baseline | 0.99x |
| macos-aarch64 | native | health | 8 | 52975.8 | 0.454 | 3.3 | within-baseline | 1.05x |
| macos-aarch64 | wasmc-full | health | 8 | 20919.1 | 1.462 | 2603.3 | within-baseline | 1.04x |
| macos-aarch64 | wasmc-full | post-json | 8 | 18294.3 | 2.131 | 2538.5 | within-baseline | 0.88x |
| macos-aarch64 | wasmc-full | root-json | 8 | 18671.7 | 2.591 | 2221.9 | within-baseline | 0.94x |
| macos-aarch64 | wasmc-tls-native-http | health | 8 | 30443.0 | 1.312 | 2104.0 | within-baseline | 1.35x |
| macos-aarch64 | native | health | 32 | 73823.7 | 1.817 | 2.6 | within-baseline | 0.98x |
| macos-aarch64 | wasmc-full | health | 32 | 23575.1 | 12.023 | 9935.2 | within-baseline | 1.01x |
| macos-aarch64 | wasmc-tls-native-http | health | 32 | 28145.4 | 6.367 | 10089.7 | within-baseline | 1.15x |
| windows-aarch64 | native | health | 1 | 8582.2 | 0.141 | 10.9 | within-baseline | 0.98x |
| windows-aarch64 | wasmc-full | health | 1 | 4213.0 | 0.252 | 1135.7 | within-baseline | 0.92x |
| windows-aarch64 | wasmc-full | post-json | 1 | 3955.9 | 0.286 | 1120.9 | within-baseline | 0.97x |
| windows-aarch64 | wasmc-full | root-json | 1 | 4019.7 | 0.283 | 1123.8 | within-baseline | 0.98x |
| windows-aarch64 | wasmc-tls-native-http | health | 1 | 4880.4 | 0.222 | 1120.4 | within-baseline | 0.95x |
| windows-aarch64 | native | health | 8 | 32128.7 | 0.748 | 10.3 | within-baseline | 0.99x |
| windows-aarch64 | wasmc-full | health | 8 | 14303.9 | 1.661 | 2409.4 | within-baseline | 1.01x |
| windows-aarch64 | wasmc-full | post-json | 8 | 11453.8 | 6.261 | 2415.9 | within-baseline | 0.91x |
| windows-aarch64 | wasmc-full | root-json | 8 | 11856.8 | 4.814 | 2449.1 | within-baseline | 0.95x |
| windows-aarch64 | wasmc-tls-native-http | health | 8 | 15463.4 | 4.155 | 2411.7 | within-baseline | 0.99x |
| windows-aarch64 | native | health | 32 | 36818.9 | 1.708 | 10.7 | within-baseline | 0.97x |
| windows-aarch64 | wasmc-full | health | 32 | 14952.6 | 62.929 | 9787.4 | advisory-regression | 0.98x |
| windows-aarch64 | wasmc-tls-native-http | health | 32 | 16655.6 | 53.735 | 9909.3 | advisory-regression | 1.03x |
| windows-x86_64 | native | health | 1 | 23275.5 | 0.067 | 8.0 | within-baseline | 1.79x |
| windows-x86_64 | wasmc-full | health | 1 | 8880.4 | 0.172 | 1241.9 | within-baseline | 1.47x |
| windows-x86_64 | wasmc-full | post-json | 1 | 7413.8 | 0.186 | 1227.0 | within-baseline | 1.51x |
| windows-x86_64 | wasmc-full | root-json | 1 | 7735.7 | 0.205 | 1246.3 | within-baseline | 1.46x |
| windows-x86_64 | wasmc-tls-native-http | health | 1 | 10355.7 | 0.138 | 1248.0 | within-baseline | 1.61x |
| windows-x86_64 | native | health | 8 | 51371.4 | 0.247 | 7.5 | within-baseline | 1.67x |
| windows-x86_64 | wasmc-full | health | 8 | 20949.2 | 2.114 | 3512.2 | within-baseline | 1.60x |
| windows-x86_64 | wasmc-full | post-json | 8 | 17223.7 | 3.347 | 3505.4 | within-baseline | 1.59x |
| windows-x86_64 | wasmc-full | root-json | 8 | 17754.7 | 4.237 | 3539.8 | within-baseline | 1.51x |
| windows-x86_64 | wasmc-tls-native-http | health | 8 | 24701.2 | 0.868 | 3576.1 | within-baseline | 1.67x |
| windows-x86_64 | native | health | 32 | 57544.8 | 0.725 | 7.9 | within-baseline | 1.68x |
| windows-x86_64 | wasmc-full | health | 32 | 24067.6 | 22.706 | 13977.0 | advisory-regression | 1.76x |
| windows-x86_64 | wasmc-tls-native-http | health | 32 | 25556.5 | 5.149 | 13975.2 | advisory-regression | 1.86x |

External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.
