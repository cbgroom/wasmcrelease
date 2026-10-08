# WAsmC external HTTPS load

Commit: 90fe37f33e53fa47707e7694da2fbfb30773110f
Measured: 2026-10-08T23:22:03.423Z
Required platforms: linux-x86_64, linux-aarch64, macos-aarch64, windows-x86_64, windows-aarch64

| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |
|---|---|---|---:|---:|---:|---:|---|---:|
| linux-aarch64 | native | health | 1 | 23274.6 | 0.051 | 2.2 | within-baseline | 0.92x |
| linux-aarch64 | wasmc-full | health | 1 | 11450.3 | 0.101 | 1027.3 | within-baseline | 0.95x |
| linux-aarch64 | wasmc-full | post-json | 1 | 9362.5 | 0.125 | 1025.5 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-full | root-json | 1 | 10070.3 | 0.116 | 1025.3 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-tls-native-http | health | 1 | 13295.2 | 0.087 | 1022.1 | within-baseline | 0.99x |
| linux-aarch64 | native | health | 8 | 85176.7 | 0.139 | 1.9 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-full | health | 8 | 25901.8 | 0.664 | 2193.3 | within-baseline | 1.01x |
| linux-aarch64 | wasmc-full | post-json | 8 | 21278.3 | 1.053 | 2183.7 | advisory-regression | 1.02x |
| linux-aarch64 | wasmc-full | root-json | 8 | 22215.2 | 0.799 | 2226.0 | within-baseline | 0.98x |
| linux-aarch64 | wasmc-tls-native-http | health | 8 | 30372.3 | 0.531 | 2207.0 | within-baseline | 0.95x |
| linux-aarch64 | native | health | 32 | 112421.3 | 1.384 | 2.1 | within-baseline | 1.00x |
| linux-aarch64 | wasmc-full | health | 32 | 32214.5 | 2.119 | 8769.7 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-tls-native-http | health | 32 | 39965.8 | 1.745 | 8820.6 | within-baseline | 1.04x |
| linux-x86_64 | native | health | 1 | 13387.9 | 0.086 | 2.4 | within-baseline | 0.96x |
| linux-x86_64 | wasmc-full | health | 1 | 6452.6 | 0.179 | 1368.2 | within-baseline | 0.98x |
| linux-x86_64 | wasmc-full | post-json | 1 | 5593.7 | 0.207 | 1378.1 | within-baseline | 0.99x |
| linux-x86_64 | wasmc-full | root-json | 1 | 5960.0 | 0.183 | 1384.1 | within-baseline | 0.98x |
| linux-x86_64 | wasmc-tls-native-http | health | 1 | 7257.9 | 0.156 | 1375.8 | within-baseline | 1.00x |
| linux-x86_64 | native | health | 8 | 65614.8 | 0.175 | 2.4 | within-baseline | 0.99x |
| linux-x86_64 | wasmc-full | health | 8 | 20823.5 | 0.691 | 4233.9 | within-baseline | 0.98x |
| linux-x86_64 | wasmc-full | post-json | 8 | 16860.5 | 0.872 | 4211.4 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-full | root-json | 8 | 18301.0 | 0.815 | 4208.9 | within-baseline | 0.98x |
| linux-x86_64 | wasmc-tls-native-http | health | 8 | 25112.0 | 0.528 | 4172.8 | within-baseline | 1.03x |
| linux-x86_64 | native | health | 32 | 78831.7 | 0.620 | 2.2 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-full | health | 32 | 21262.1 | 2.822 | 17103.0 | within-baseline | 0.96x |
| linux-x86_64 | wasmc-tls-native-http | health | 32 | 24979.4 | 2.559 | 17072.6 | within-baseline | 0.99x |
| macos-aarch64 | native | health | 1 | 8700.3 | 0.187 | 4.6 | within-baseline | 0.89x |
| macos-aarch64 | wasmc-full | health | 1 | 6083.0 | 0.318 | 1255.2 | advisory-regression | 0.84x |
| macos-aarch64 | wasmc-full | post-json | 1 | 5455.6 | 0.425 | 1056.0 | within-baseline | 0.86x |
| macos-aarch64 | wasmc-full | root-json | 1 | 5751.6 | 0.359 | 1222.0 | advisory-regression | 0.81x |
| macos-aarch64 | wasmc-tls-native-http | health | 1 | 6399.3 | 0.329 | 1269.1 | advisory-regression | 0.98x |
| macos-aarch64 | native | health | 8 | 44922.1 | 0.594 | 6.5 | advisory-regression | 0.94x |
| macos-aarch64 | wasmc-full | health | 8 | 20694.5 | 2.267 | 2898.6 | within-baseline | 1.03x |
| macos-aarch64 | wasmc-full | post-json | 8 | 13940.8 | 4.161 | 3129.9 | advisory-regression | 0.77x |
| macos-aarch64 | wasmc-full | root-json | 8 | 18111.5 | 3.962 | 2989.8 | advisory-regression | 0.97x |
| macos-aarch64 | wasmc-tls-native-http | health | 8 | 20433.2 | 1.761 | 3147.9 | advisory-regression | 0.87x |
| macos-aarch64 | native | health | 32 | 65215.2 | 2.223 | 5.0 | advisory-regression | 0.96x |
| macos-aarch64 | wasmc-full | health | 32 | 21127.6 | 11.036 | 10595.1 | within-baseline | 0.97x |
| macos-aarch64 | wasmc-tls-native-http | health | 32 | 22001.9 | 13.531 | 10685.8 | advisory-regression | 0.95x |
| macos-x86_64 | native | health | 1 | 2288.3 | 0.486 | 5.6 | within-baseline | 0.88x |
| macos-x86_64 | wasmc-full | health | 1 | 1819.3 | 0.930 | 2287.9 | advisory-regression | 1.15x |
| macos-x86_64 | wasmc-full | post-json | 1 | 1518.9 | 1.183 | 1766.6 | within-baseline | 1.08x |
| macos-x86_64 | wasmc-full | root-json | 1 | 1421.7 | 1.096 | 1922.5 | advisory-regression | 1.11x |
| macos-x86_64 | wasmc-tls-native-http | health | 1 | 1817.7 | 1.687 | 1641.4 | advisory-regression | 1.42x |
| macos-x86_64 | native | health | 8 | 11697.6 | 1.631 | 5.3 | within-baseline | 0.96x |
| macos-x86_64 | wasmc-full | health | 8 | 5509.1 | 4.629 | 4716.8 | within-baseline | 0.99x |
| macos-x86_64 | wasmc-full | post-json | 8 | 4760.5 | 7.637 | 5721.0 | within-baseline | 0.87x |
| macos-x86_64 | wasmc-full | root-json | 8 | 4257.2 | 11.170 | 5605.2 | advisory-regression | 0.73x |
| macos-x86_64 | wasmc-tls-native-http | health | 8 | 6019.1 | 4.387 | 5543.4 | within-baseline | 0.87x |
| macos-x86_64 | native | health | 32 | 28707.7 | 4.722 | 5.4 | within-baseline | 1.22x |
| macos-x86_64 | wasmc-full | health | 32 | 5964.8 | 129.880 | 20310.2 | within-baseline | 0.86x |
| macos-x86_64 | wasmc-tls-native-http | health | 32 | 6083.5 | 129.985 | 21967.4 | advisory-regression | 0.80x |
| windows-aarch64 | native | health | 1 | 8996.5 | 0.126 | 10.4 | within-baseline | 1.03x |
| windows-aarch64 | wasmc-full | health | 1 | 4628.0 | 0.241 | 1121.2 | within-baseline | 1.06x |
| windows-aarch64 | wasmc-full | post-json | 1 | 4033.3 | 0.272 | 1116.5 | within-baseline | 1.02x |
| windows-aarch64 | wasmc-full | root-json | 1 | 4215.6 | 0.268 | 1125.9 | within-baseline | 1.05x |
| windows-aarch64 | wasmc-tls-native-http | health | 1 | 5286.6 | 0.210 | 1107.8 | within-baseline | 1.06x |
| windows-aarch64 | native | health | 8 | 31794.4 | 0.741 | 10.3 | within-baseline | 0.98x |
| windows-aarch64 | wasmc-full | health | 8 | 14568.4 | 3.123 | 2419.2 | within-baseline | 1.04x |
| windows-aarch64 | wasmc-full | post-json | 8 | 12838.1 | 6.238 | 2335.8 | within-baseline | 1.06x |
| windows-aarch64 | wasmc-full | root-json | 8 | 12430.1 | 4.055 | 2411.5 | within-baseline | 1.03x |
| windows-aarch64 | wasmc-tls-native-http | health | 8 | 16289.2 | 4.105 | 2417.5 | within-baseline | 1.05x |
| windows-aarch64 | native | health | 32 | 37990.5 | 1.602 | 10.4 | within-baseline | 1.03x |
| windows-aarch64 | wasmc-full | health | 32 | 16092.1 | 19.487 | 9712.2 | within-baseline | 1.08x |
| windows-aarch64 | wasmc-tls-native-http | health | 32 | 17998.2 | 16.154 | 9794.6 | within-baseline | 1.12x |
| windows-x86_64 | native | health | 1 | 9345.7 | 0.123 | 9.3 | advisory-regression | 0.71x |
| windows-x86_64 | wasmc-full | health | 1 | 4878.8 | 0.238 | 1547.5 | advisory-regression | 0.79x |
| windows-x86_64 | wasmc-full | post-json | 1 | 3893.5 | 0.265 | 1538.3 | advisory-regression | 0.77x |
| windows-x86_64 | wasmc-full | root-json | 1 | 4139.9 | 0.250 | 1547.8 | advisory-regression | 0.76x |
| windows-x86_64 | wasmc-tls-native-http | health | 1 | 4806.6 | 0.221 | 1555.3 | advisory-regression | 0.69x |
| windows-x86_64 | native | health | 8 | 27221.3 | 0.428 | 9.0 | within-baseline | 0.85x |
| windows-x86_64 | wasmc-full | health | 8 | 10884.7 | 4.701 | 4610.1 | advisory-regression | 0.80x |
| windows-x86_64 | wasmc-full | post-json | 8 | 9089.0 | 6.985 | 4643.4 | within-baseline | 0.84x |
| windows-x86_64 | wasmc-full | root-json | 8 | 9798.5 | 6.009 | 4599.0 | advisory-regression | 0.75x |
| windows-x86_64 | wasmc-tls-native-http | health | 8 | 12135.6 | 4.534 | 4575.6 | advisory-regression | 0.82x |
| windows-x86_64 | native | health | 32 | 30275.2 | 1.221 | 9.3 | within-baseline | 0.89x |
| windows-x86_64 | wasmc-full | health | 32 | 12458.5 | 4.043 | 18127.4 | within-baseline | 0.89x |
| windows-x86_64 | wasmc-tls-native-http | health | 32 | 14712.9 | 3.413 | 18554.0 | within-baseline | 1.03x |

External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.
