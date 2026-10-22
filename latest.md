# WAsmC external HTTPS load

Commit: c49933e0263ecac3fe085b6342a6508bfd7f2374
Measured: 2026-10-22T21:46:28.915Z
Required platforms: linux-x86_64, linux-aarch64, macos-aarch64, windows-x86_64, windows-aarch64

| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |
|---|---|---|---:|---:|---:|---:|---|---:|
| linux-aarch64 | native | health | 1 | 21991.1 | 0.053 | 2.0 | within-baseline | 0.91x |
| linux-aarch64 | wasmc-full | health | 1 | 11275.5 | 0.106 | 1033.5 | within-baseline | 0.94x |
| linux-aarch64 | wasmc-full | post-json | 1 | 9025.2 | 0.125 | 1037.0 | within-baseline | 0.96x |
| linux-aarch64 | wasmc-full | root-json | 1 | 10227.0 | 0.113 | 1030.9 | within-baseline | 1.00x |
| linux-aarch64 | wasmc-tls-native-http | health | 1 | 11823.4 | 0.091 | 1033.6 | within-baseline | 0.89x |
| linux-aarch64 | native | health | 8 | 84606.8 | 0.171 | 1.9 | within-baseline | 0.96x |
| linux-aarch64 | wasmc-full | health | 8 | 23512.0 | 0.748 | 2285.2 | within-baseline | 0.92x |
| linux-aarch64 | wasmc-full | post-json | 8 | 19773.2 | 0.845 | 2325.8 | within-baseline | 0.95x |
| linux-aarch64 | wasmc-full | root-json | 8 | 20401.2 | 0.920 | 2296.0 | within-baseline | 0.91x |
| linux-aarch64 | wasmc-tls-native-http | health | 8 | 31278.3 | 0.614 | 2289.4 | within-baseline | 1.00x |
| linux-aarch64 | native | health | 32 | 109137.6 | 1.180 | 2.0 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-full | health | 32 | 30752.0 | 2.437 | 9149.3 | within-baseline | 0.95x |
| linux-aarch64 | wasmc-tls-native-http | health | 32 | 37606.9 | 2.084 | 9153.3 | within-baseline | 0.98x |
| linux-x86_64 | native | health | 1 | 13798.8 | 0.082 | 2.1 | within-baseline | 1.00x |
| linux-x86_64 | wasmc-full | health | 1 | 6652.8 | 0.162 | 1342.6 | within-baseline | 1.03x |
| linux-x86_64 | wasmc-full | post-json | 1 | 5624.2 | 0.188 | 1339.4 | within-baseline | 1.00x |
| linux-x86_64 | wasmc-full | root-json | 1 | 6165.5 | 0.177 | 1342.0 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-tls-native-http | health | 1 | 7252.5 | 0.154 | 1347.9 | within-baseline | 1.00x |
| linux-x86_64 | native | health | 8 | 67307.8 | 0.159 | 2.1 | within-baseline | 1.02x |
| linux-x86_64 | wasmc-full | health | 8 | 20911.3 | 0.729 | 4074.0 | within-baseline | 0.99x |
| linux-x86_64 | wasmc-full | post-json | 8 | 16961.3 | 0.829 | 4061.2 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-full | root-json | 8 | 18320.9 | 0.794 | 4060.9 | within-baseline | 0.98x |
| linux-x86_64 | wasmc-tls-native-http | health | 8 | 23588.3 | 0.607 | 4061.4 | within-baseline | 0.94x |
| linux-x86_64 | native | health | 32 | 78522.2 | 0.602 | 2.0 | within-baseline | 1.00x |
| linux-x86_64 | wasmc-full | health | 32 | 22698.0 | 2.767 | 16469.4 | within-baseline | 1.03x |
| linux-x86_64 | wasmc-tls-native-http | health | 32 | 25947.5 | 2.439 | 16490.0 | within-baseline | 1.02x |
| macos-aarch64 | native | health | 1 | 8813.3 | 0.132 | 6.3 | within-baseline | 1.01x |
| macos-aarch64 | wasmc-full | health | 1 | 6830.8 | 0.362 | 1083.6 | within-baseline | 0.95x |
| macos-aarch64 | wasmc-full | post-json | 1 | 5665.8 | 0.423 | 1207.4 | within-baseline | 0.94x |
| macos-aarch64 | wasmc-full | root-json | 1 | 5397.3 | 0.467 | 1049.8 | advisory-regression | 0.77x |
| macos-aarch64 | wasmc-tls-native-http | health | 1 | 5871.2 | 0.233 | 911.1 | within-baseline | 0.92x |
| macos-aarch64 | native | health | 8 | 38115.9 | 0.814 | 5.3 | advisory-regression | 0.80x |
| macos-aarch64 | wasmc-full | health | 8 | 20832.4 | 2.418 | 2847.3 | within-baseline | 1.01x |
| macos-aarch64 | wasmc-full | post-json | 8 | 14804.8 | 3.854 | 2663.9 | within-baseline | 0.97x |
| macos-aarch64 | wasmc-full | root-json | 8 | 18508.1 | 2.641 | 2452.7 | within-baseline | 0.99x |
| macos-aarch64 | wasmc-tls-native-http | health | 8 | 17449.6 | 2.777 | 3120.4 | advisory-regression | 0.84x |
| macos-aarch64 | native | health | 32 | 69464.4 | 1.505 | 3.8 | within-baseline | 1.07x |
| macos-aarch64 | wasmc-full | health | 32 | 29384.8 | 7.589 | 8027.7 | within-baseline | 1.35x |
| macos-aarch64 | wasmc-tls-native-http | health | 32 | 30316.6 | 5.855 | 8559.3 | within-baseline | 1.38x |
| macos-x86_64 | native | health | 1 | 2263.2 | 0.544 | 7.5 | advisory-regression | 0.99x |
| macos-x86_64 | wasmc-full | health | 1 | 1522.6 | 0.848 | 2173.4 | within-baseline | 0.96x |
| macos-x86_64 | wasmc-full | post-json | 1 | 1353.4 | 0.814 | 2119.3 | within-baseline | 0.95x |
| macos-x86_64 | wasmc-full | root-json | 1 | 1466.0 | 1.022 | 2140.7 | within-baseline | 1.14x |
| macos-x86_64 | wasmc-tls-native-http | health | 1 | 1091.2 | 1.802 | 2114.0 | advisory-regression | 0.85x |
| macos-x86_64 | native | health | 8 | 11634.3 | 1.781 | 5.6 | within-baseline | 0.99x |
| macos-x86_64 | wasmc-full | health | 8 | 5284.2 | 4.812 | 6767.4 | advisory-regression | 0.96x |
| macos-x86_64 | wasmc-full | post-json | 8 | 4002.2 | 11.392 | 6384.7 | advisory-regression | 0.79x |
| macos-x86_64 | wasmc-full | root-json | 8 | 5003.6 | 6.636 | 6438.8 | within-baseline | 1.01x |
| macos-x86_64 | wasmc-tls-native-http | health | 8 | 6535.9 | 5.242 | 6639.7 | within-baseline | 1.09x |
| macos-x86_64 | native | health | 32 | 24296.0 | 5.741 | 7.0 | advisory-regression | 1.03x |
| macos-x86_64 | wasmc-full | health | 32 | 6274.0 | 128.077 | 28031.7 | advisory-regression | 0.96x |
| macos-x86_64 | wasmc-tls-native-http | health | 32 | 6130.3 | 127.088 | 26682.1 | within-baseline | 1.01x |
| windows-aarch64 | native | health | 1 | 8285.4 | 0.136 | 11.2 | within-baseline | 0.95x |
| windows-aarch64 | wasmc-full | health | 1 | 4245.5 | 0.243 | 1141.9 | within-baseline | 0.97x |
| windows-aarch64 | wasmc-full | post-json | 1 | 3711.8 | 0.291 | 1133.0 | within-baseline | 0.94x |
| windows-aarch64 | wasmc-full | root-json | 1 | 3765.1 | 0.289 | 1118.9 | within-baseline | 0.94x |
| windows-aarch64 | wasmc-tls-native-http | health | 1 | 4786.6 | 0.232 | 1144.7 | within-baseline | 0.96x |
| windows-aarch64 | native | health | 8 | 30593.0 | 0.749 | 10.7 | within-baseline | 0.95x |
| windows-aarch64 | wasmc-full | health | 8 | 13896.3 | 6.666 | 2443.1 | advisory-regression | 0.99x |
| windows-aarch64 | wasmc-full | post-json | 8 | 11999.1 | 7.746 | 2455.2 | within-baseline | 0.99x |
| windows-aarch64 | wasmc-full | root-json | 8 | 12639.9 | 6.975 | 2456.1 | within-baseline | 1.02x |
| windows-aarch64 | wasmc-tls-native-http | health | 8 | 14863.3 | 3.678 | 2473.7 | within-baseline | 0.96x |
| windows-aarch64 | native | health | 32 | 35954.6 | 1.725 | 10.8 | within-baseline | 0.98x |
| windows-aarch64 | wasmc-full | health | 32 | 14512.9 | 61.291 | 10026.9 | advisory-regression | 0.97x |
| windows-aarch64 | wasmc-tls-native-http | health | 32 | 13877.7 | 21.672 | 10082.8 | advisory-regression | 0.83x |
| windows-x86_64 | native | health | 1 | 9564.3 | 0.149 | 13.4 | advisory-regression | 0.73x |
| windows-x86_64 | wasmc-full | health | 1 | 5518.4 | 0.258 | 1571.4 | within-baseline | 0.92x |
| windows-x86_64 | wasmc-full | post-json | 1 | 4581.6 | 0.315 | 1571.5 | within-baseline | 0.96x |
| windows-x86_64 | wasmc-full | root-json | 1 | 5015.7 | 0.287 | 1596.8 | within-baseline | 0.96x |
| windows-x86_64 | wasmc-tls-native-http | health | 1 | 6249.3 | 0.238 | 1570.5 | within-baseline | 0.94x |
| windows-x86_64 | native | health | 8 | 29008.5 | 0.455 | 9.3 | within-baseline | 1.07x |
| windows-x86_64 | wasmc-full | health | 8 | 11377.5 | 5.799 | 4611.6 | within-baseline | 0.83x |
| windows-x86_64 | wasmc-full | post-json | 8 | 11042.7 | 6.475 | 4617.4 | within-baseline | 1.03x |
| windows-x86_64 | wasmc-full | root-json | 8 | 12094.1 | 8.463 | 4603.6 | advisory-regression | 1.08x |
| windows-x86_64 | wasmc-tls-native-http | health | 8 | 13242.9 | 3.799 | 4637.5 | within-baseline | 0.90x |
| windows-x86_64 | native | health | 32 | 33080.5 | 1.271 | 9.5 | within-baseline | 0.97x |
| windows-x86_64 | wasmc-full | health | 32 | 14172.7 | 10.669 | 18455.9 | within-baseline | 1.01x |
| windows-x86_64 | wasmc-tls-native-http | health | 32 | 16785.0 | 7.960 | 18497.0 | advisory-regression | 1.14x |

External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.
