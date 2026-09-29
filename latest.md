# WAsmC external HTTPS load

Commit: de1971cd59b5790757c23f3b847993c00c4e60a9
Measured: 2026-09-29T12:19:55.401Z
Required platforms: linux-x86_64, linux-aarch64, macos-aarch64, windows-x86_64, windows-aarch64

| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |
|---|---|---|---:|---:|---:|---:|---|---:|
| linux-aarch64 | native | health | 1 | 24053.3 | 0.050 | 2.2 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-full | health | 1 | 12103.4 | 0.098 | 1009.3 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-full | post-json | 1 | 9498.9 | 0.122 | 1035.8 | within-baseline | 1.01x |
| linux-aarch64 | wasmc-full | root-json | 1 | 10742.2 | 0.110 | 1031.2 | within-baseline | 1.04x |
| linux-aarch64 | wasmc-tls-native-http | health | 1 | 13476.0 | 0.088 | 1034.5 | within-baseline | 1.00x |
| linux-aarch64 | native | health | 8 | 81425.4 | 0.187 | 2.0 | within-baseline | 0.94x |
| linux-aarch64 | wasmc-full | health | 8 | 25654.4 | 0.808 | 2232.6 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-full | post-json | 8 | 20850.2 | 0.768 | 2258.9 | within-baseline | 1.00x |
| linux-aarch64 | wasmc-full | root-json | 8 | 21740.3 | 1.129 | 2241.2 | advisory-regression | 0.94x |
| linux-aarch64 | wasmc-tls-native-http | health | 8 | 31869.1 | 0.690 | 2316.4 | within-baseline | 0.98x |
| linux-aarch64 | native | health | 32 | 112536.1 | 1.179 | 2.1 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-full | health | 32 | 32552.8 | 2.239 | 8740.2 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-tls-native-http | health | 32 | 37917.1 | 2.058 | 8820.0 | within-baseline | 0.95x |
| linux-x86_64 | native | health | 1 | 11657.1 | 0.097 | 2.4 | within-baseline | 0.83x |
| linux-x86_64 | wasmc-full | health | 1 | 6043.2 | 0.207 | 1368.9 | advisory-regression | 0.90x |
| linux-x86_64 | wasmc-full | post-json | 1 | 4996.1 | 0.240 | 1367.7 | advisory-regression | 0.88x |
| linux-x86_64 | wasmc-full | root-json | 1 | 5633.4 | 0.202 | 1369.7 | within-baseline | 0.93x |
| linux-x86_64 | wasmc-tls-native-http | health | 1 | 7022.1 | 0.172 | 1378.2 | within-baseline | 0.96x |
| linux-x86_64 | native | health | 8 | 64235.7 | 0.170 | 2.4 | within-baseline | 0.96x |
| linux-x86_64 | wasmc-full | health | 8 | 20966.5 | 0.637 | 4151.0 | within-baseline | 0.99x |
| linux-x86_64 | wasmc-full | post-json | 8 | 16718.8 | 0.883 | 4153.2 | within-baseline | 1.00x |
| linux-x86_64 | wasmc-full | root-json | 8 | 18656.7 | 0.787 | 4148.4 | within-baseline | 1.00x |
| linux-x86_64 | wasmc-tls-native-http | health | 8 | 23020.5 | 0.535 | 4175.0 | within-baseline | 0.94x |
| linux-x86_64 | native | health | 32 | 78232.8 | 0.635 | 2.3 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-full | health | 32 | 21694.5 | 2.876 | 17048.4 | within-baseline | 0.96x |
| linux-x86_64 | wasmc-tls-native-http | health | 32 | 24703.6 | 2.600 | 16950.6 | within-baseline | 0.96x |
| macos-aarch64 | native | health | 1 | 7588.2 | 0.176 | 9.3 | advisory-regression | 0.64x |
| macos-aarch64 | wasmc-full | health | 1 | 5932.1 | 0.379 | 1006.4 | advisory-regression | 0.81x |
| macos-aarch64 | wasmc-full | post-json | 1 | 6040.3 | 0.437 | 997.2 | advisory-regression | 0.92x |
| macos-aarch64 | wasmc-full | root-json | 1 | 5900.3 | 0.477 | 1225.7 | advisory-regression | 0.82x |
| macos-aarch64 | wasmc-tls-native-http | health | 1 | 5817.5 | 0.397 | 995.3 | advisory-regression | 0.77x |
| macos-aarch64 | native | health | 8 | 47694.8 | 0.512 | 3.9 | within-baseline | 0.94x |
| macos-aarch64 | wasmc-full | health | 8 | 19139.3 | 2.347 | 2427.0 | advisory-regression | 0.91x |
| macos-aarch64 | wasmc-full | post-json | 8 | 14874.0 | 3.303 | 2394.5 | advisory-regression | 0.81x |
| macos-aarch64 | wasmc-full | root-json | 8 | 20955.6 | 2.418 | 2753.1 | within-baseline | 1.12x |
| macos-aarch64 | wasmc-tls-native-http | health | 8 | 23393.1 | 1.395 | 2922.8 | advisory-regression | 0.94x |
| macos-aarch64 | native | health | 32 | 63427.2 | 2.612 | 3.4 | advisory-regression | 0.86x |
| macos-aarch64 | wasmc-full | health | 32 | 16693.0 | 20.314 | 10189.4 | advisory-regression | 0.71x |
| macos-aarch64 | wasmc-tls-native-http | health | 32 | 21725.3 | 9.400 | 10006.8 | within-baseline | 0.88x |
| macos-x86_64 | native | health | 1 | 2253.3 | 0.794 | 6.5 | advisory-regression | 0.87x |
| macos-x86_64 | wasmc-full | health | 1 | 1477.5 | 0.943 | 1891.0 | advisory-regression | 0.88x |
| macos-x86_64 | wasmc-full | post-json | 1 | 1404.0 | 1.101 | 1933.6 | within-baseline | 0.99x |
| macos-x86_64 | wasmc-full | root-json | 1 | 1284.8 | 0.850 | 2023.0 | advisory-regression | 0.97x |
| macos-x86_64 | wasmc-tls-native-http | health | 1 | 1488.2 | 1.294 | 2186.4 | advisory-regression | 1.01x |
| macos-x86_64 | native | health | 8 | 7855.8 | 2.772 | 7.4 | advisory-regression | 0.65x |
| macos-x86_64 | wasmc-full | health | 8 | 6194.0 | 4.373 | 5945.5 | advisory-regression | 1.16x |
| macos-x86_64 | wasmc-full | post-json | 8 | 5052.1 | 9.348 | 5660.8 | advisory-regression | 0.72x |
| macos-x86_64 | wasmc-full | root-json | 8 | 5845.6 | 4.566 | 6089.4 | advisory-regression | 0.95x |
| macos-x86_64 | wasmc-tls-native-http | health | 8 | 4885.5 | 5.984 | 7033.7 | advisory-regression | 0.59x |
| macos-x86_64 | native | health | 32 | 23577.3 | 4.642 | 7.0 | advisory-regression | 0.92x |
| macos-x86_64 | wasmc-full | health | 32 | 6908.3 | 126.683 | 24782.0 | advisory-regression | 0.97x |
| macos-x86_64 | wasmc-tls-native-http | health | 32 | 5897.4 | 126.456 | 25211.4 | advisory-regression | 0.77x |
| windows-aarch64 | native | health | 1 | 8199.2 | 0.158 | 13.3 | within-baseline | 0.93x |
| windows-aarch64 | wasmc-full | health | 1 | 4253.0 | 0.260 | 1142.8 | within-baseline | 0.95x |
| windows-aarch64 | wasmc-full | post-json | 1 | 3655.4 | 0.314 | 1150.8 | within-baseline | 0.92x |
| windows-aarch64 | wasmc-full | root-json | 1 | 4013.5 | 0.296 | 1151.8 | within-baseline | 0.97x |
| windows-aarch64 | wasmc-tls-native-http | health | 1 | 4543.9 | 0.246 | 1161.9 | within-baseline | 0.90x |
| windows-aarch64 | native | health | 8 | 30400.8 | 0.739 | 11.8 | within-baseline | 0.95x |
| windows-aarch64 | wasmc-full | health | 8 | 12498.3 | 4.823 | 2565.9 | within-baseline | 0.88x |
| windows-aarch64 | wasmc-full | post-json | 8 | 11096.6 | 9.820 | 2612.1 | advisory-regression | 0.90x |
| windows-aarch64 | wasmc-full | root-json | 8 | 11994.4 | 10.066 | 2616.4 | advisory-regression | 0.98x |
| windows-aarch64 | wasmc-tls-native-http | health | 8 | 14008.5 | 4.729 | 2584.1 | within-baseline | 0.90x |
| windows-aarch64 | native | health | 32 | 35775.1 | 1.740 | 12.2 | within-baseline | 0.96x |
| windows-aarch64 | wasmc-full | health | 32 | 10305.4 | 25.763 | 10584.2 | advisory-regression | 0.68x |
| windows-aarch64 | wasmc-tls-native-http | health | 32 | 14194.7 | 19.949 | 10466.9 | within-baseline | 0.88x |
| windows-x86_64 | native | health | 1 | 12581.5 | 0.119 | 9.7 | within-baseline | 0.96x |
| windows-x86_64 | wasmc-full | health | 1 | 5990.8 | 0.237 | 1558.4 | within-baseline | 0.98x |
| windows-x86_64 | wasmc-full | post-json | 1 | 4763.9 | 0.271 | 1574.2 | within-baseline | 0.95x |
| windows-x86_64 | wasmc-full | root-json | 1 | 5232.3 | 0.253 | 1561.9 | within-baseline | 0.96x |
| windows-x86_64 | wasmc-tls-native-http | health | 1 | 6635.9 | 0.212 | 1569.7 | within-baseline | 1.03x |
| windows-x86_64 | native | health | 8 | 26976.5 | 0.438 | 9.0 | within-baseline | 0.87x |
| windows-x86_64 | wasmc-full | health | 8 | 13652.5 | 4.798 | 4641.9 | within-baseline | 1.01x |
| windows-x86_64 | wasmc-full | post-json | 8 | 10678.2 | 6.062 | 4684.3 | within-baseline | 0.99x |
| windows-x86_64 | wasmc-full | root-json | 8 | 11159.7 | 5.726 | 4635.0 | within-baseline | 0.91x |
| windows-x86_64 | wasmc-tls-native-http | health | 8 | 14758.5 | 4.272 | 4603.9 | within-baseline | 0.98x |
| windows-x86_64 | native | health | 32 | 33952.8 | 1.231 | 9.2 | within-baseline | 0.99x |
| windows-x86_64 | wasmc-full | health | 32 | 14072.9 | 10.703 | 18489.8 | within-baseline | 0.98x |
| windows-x86_64 | wasmc-tls-native-http | health | 32 | 14304.2 | 3.746 | 18462.6 | within-baseline | 1.03x |

External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.
