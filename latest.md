# WAsmC external HTTPS load

Commit: e0202c8b3c67a344c63856356ff751820e21deae
Measured: 2026-09-21T08:55:23.673Z
Required platforms: linux-x86_64, linux-aarch64, macos-aarch64, windows-x86_64, windows-aarch64

| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |
|---|---|---|---:|---:|---:|---:|---|---:|
| linux-aarch64 | native | health | 1 | 24187.3 | 0.049 | 2.2 | bootstrap | - |
| linux-aarch64 | wasmc-full | health | 1 | 11945.4 | 0.098 | 1024.0 | bootstrap | - |
| linux-aarch64 | wasmc-full | post-json | 1 | 8912.4 | 0.119 | 1037.3 | bootstrap | - |
| linux-aarch64 | wasmc-full | root-json | 1 | 10648.4 | 0.109 | 1025.7 | bootstrap | - |
| linux-aarch64 | wasmc-tls-native-http | health | 1 | 13262.2 | 0.085 | 1046.9 | bootstrap | - |
| linux-aarch64 | native | health | 8 | 84527.7 | 0.200 | 2.1 | bootstrap | - |
| linux-aarch64 | wasmc-full | health | 8 | 24816.0 | 0.939 | 2280.7 | bootstrap | - |
| linux-aarch64 | wasmc-full | post-json | 8 | 19926.8 | 0.884 | 2309.4 | bootstrap | - |
| linux-aarch64 | wasmc-full | root-json | 8 | 20737.2 | 0.877 | 2350.8 | bootstrap | - |
| linux-aarch64 | wasmc-tls-native-http | health | 8 | 29909.6 | 0.546 | 2310.5 | bootstrap | - |
| linux-aarch64 | native | health | 32 | 105430.3 | 0.816 | 2.2 | bootstrap | - |
| linux-aarch64 | wasmc-full | health | 32 | 31067.7 | 2.342 | 9174.5 | bootstrap | - |
| linux-aarch64 | wasmc-tls-native-http | health | 32 | 37677.3 | 2.125 | 9241.2 | bootstrap | - |
| linux-x86_64 | native | health | 1 | 13346.0 | 0.088 | 2.1 | bootstrap | - |
| linux-x86_64 | wasmc-full | health | 1 | 6526.7 | 0.167 | 1351.7 | bootstrap | - |
| linux-x86_64 | wasmc-full | post-json | 1 | 5656.7 | 0.196 | 1353.8 | bootstrap | - |
| linux-x86_64 | wasmc-full | root-json | 1 | 5926.7 | 0.190 | 1351.9 | bootstrap | - |
| linux-x86_64 | wasmc-tls-native-http | health | 1 | 7263.2 | 0.153 | 1371.6 | bootstrap | - |
| linux-x86_64 | native | health | 8 | 65705.7 | 0.181 | 2.2 | bootstrap | - |
| linux-x86_64 | wasmc-full | health | 8 | 20884.9 | 0.633 | 4084.6 | bootstrap | - |
| linux-x86_64 | wasmc-full | post-json | 8 | 16906.3 | 0.872 | 4063.6 | bootstrap | - |
| linux-x86_64 | wasmc-full | root-json | 8 | 18273.1 | 0.822 | 4124.2 | bootstrap | - |
| linux-x86_64 | wasmc-tls-native-http | health | 8 | 23966.1 | 0.620 | 4073.8 | bootstrap | - |
| linux-x86_64 | native | health | 32 | 77297.6 | 0.610 | 2.1 | bootstrap | - |
| linux-x86_64 | wasmc-full | health | 32 | 22324.2 | 2.766 | 16888.9 | bootstrap | - |
| linux-x86_64 | wasmc-tls-native-http | health | 32 | 25512.0 | 2.431 | 16686.8 | bootstrap | - |
| macos-aarch64 | native | health | 1 | 8928.3 | 0.265 | 4.9 | bootstrap | - |
| macos-aarch64 | wasmc-full | health | 1 | 5885.0 | 0.386 | 1271.3 | bootstrap | - |
| macos-aarch64 | wasmc-full | post-json | 1 | 5670.1 | 0.433 | 1094.6 | bootstrap | - |
| macos-aarch64 | wasmc-full | root-json | 1 | 4967.0 | 0.376 | 1162.4 | bootstrap | - |
| macos-aarch64 | wasmc-tls-native-http | health | 1 | 6332.9 | 0.297 | 1125.3 | bootstrap | - |
| macos-aarch64 | native | health | 8 | 52006.5 | 0.678 | 6.7 | bootstrap | - |
| macos-aarch64 | wasmc-full | health | 8 | 16428.1 | 2.132 | 2539.8 | bootstrap | - |
| macos-aarch64 | wasmc-full | post-json | 8 | 21556.6 | 2.105 | 2486.7 | bootstrap | - |
| macos-aarch64 | wasmc-full | root-json | 8 | 19859.6 | 2.815 | 2580.4 | bootstrap | - |
| macos-aarch64 | wasmc-tls-native-http | health | 8 | 18781.5 | 1.490 | 2862.8 | bootstrap | - |
| macos-aarch64 | native | health | 32 | 79182.3 | 1.742 | 4.3 | bootstrap | - |
| macos-aarch64 | wasmc-full | health | 32 | 17165.1 | 10.134 | 10046.8 | bootstrap | - |
| macos-aarch64 | wasmc-tls-native-http | health | 32 | 20756.1 | 8.742 | 10268.6 | bootstrap | - |
| macos-x86_64 | native | health | 1 | 3192.1 | 0.371 | 4.6 | bootstrap | - |
| macos-x86_64 | wasmc-full | health | 1 | 2256.2 | 0.706 | 1411.3 | bootstrap | - |
| macos-x86_64 | wasmc-full | post-json | 1 | 1815.8 | 0.867 | 1396.3 | bootstrap | - |
| macos-x86_64 | wasmc-full | root-json | 1 | 2217.8 | 0.527 | 1425.1 | bootstrap | - |
| macos-x86_64 | wasmc-tls-native-http | health | 1 | 2417.6 | 0.503 | 1387.1 | bootstrap | - |
| macos-x86_64 | native | health | 8 | 14427.9 | 1.141 | 4.4 | bootstrap | - |
| macos-x86_64 | wasmc-full | health | 8 | 9331.0 | 3.560 | 3625.5 | bootstrap | - |
| macos-x86_64 | wasmc-full | post-json | 8 | 7672.6 | 4.385 | 3381.9 | bootstrap | - |
| macos-x86_64 | wasmc-full | root-json | 8 | 6154.7 | 7.583 | 3505.1 | bootstrap | - |
| macos-x86_64 | wasmc-tls-native-http | health | 8 | 9262.0 | 2.683 | 3340.8 | bootstrap | - |
| macos-x86_64 | native | health | 32 | 32614.9 | 3.896 | 4.5 | bootstrap | - |
| macos-x86_64 | wasmc-full | health | 32 | 8651.6 | 106.297 | 13862.7 | bootstrap | - |
| macos-x86_64 | wasmc-tls-native-http | health | 32 | 9121.2 | 39.042 | 13698.1 | bootstrap | - |
| windows-aarch64 | native | health | 1 | 8785.6 | 0.150 | 11.5 | bootstrap | - |
| windows-aarch64 | wasmc-full | health | 1 | 4645.3 | 0.240 | 1116.4 | bootstrap | - |
| windows-aarch64 | wasmc-full | post-json | 1 | 4207.7 | 0.278 | 1125.2 | bootstrap | - |
| windows-aarch64 | wasmc-full | root-json | 1 | 4053.6 | 0.263 | 1128.3 | bootstrap | - |
| windows-aarch64 | wasmc-tls-native-http | health | 1 | 5140.1 | 0.220 | 1123.8 | bootstrap | - |
| windows-aarch64 | native | health | 8 | 32824.7 | 0.695 | 10.1 | bootstrap | - |
| windows-aarch64 | wasmc-full | health | 8 | 14211.8 | 5.494 | 2462.9 | bootstrap | - |
| windows-aarch64 | wasmc-full | post-json | 8 | 12630.7 | 7.626 | 2413.2 | bootstrap | - |
| windows-aarch64 | wasmc-full | root-json | 8 | 13327.7 | 7.274 | 2386.2 | bootstrap | - |
| windows-aarch64 | wasmc-tls-native-http | health | 8 | 13667.5 | 4.385 | 2429.8 | bootstrap | - |
| windows-aarch64 | native | health | 32 | 38620.9 | 1.570 | 11.2 | bootstrap | - |
| windows-aarch64 | wasmc-full | health | 32 | 14968.3 | 24.662 | 9806.8 | bootstrap | - |
| windows-aarch64 | wasmc-tls-native-http | health | 32 | 17751.6 | 26.868 | 9801.1 | bootstrap | - |
| windows-x86_64 | native | health | 1 | 12991.3 | 0.120 | 10.2 | bootstrap | - |
| windows-x86_64 | wasmc-full | health | 1 | 5989.4 | 0.241 | 1562.8 | bootstrap | - |
| windows-x86_64 | wasmc-full | post-json | 1 | 4770.3 | 0.272 | 1549.6 | bootstrap | - |
| windows-x86_64 | wasmc-full | root-json | 1 | 5105.4 | 0.244 | 1533.9 | bootstrap | - |
| windows-x86_64 | wasmc-tls-native-http | health | 1 | 6697.3 | 0.208 | 1567.2 | bootstrap | - |
| windows-x86_64 | native | health | 8 | 30834.5 | 0.417 | 8.9 | bootstrap | - |
| windows-x86_64 | wasmc-full | health | 8 | 12941.1 | 6.335 | 4807.8 | bootstrap | - |
| windows-x86_64 | wasmc-full | post-json | 8 | 11197.4 | 9.161 | 4707.1 | bootstrap | - |
| windows-x86_64 | wasmc-full | root-json | 8 | 10737.0 | 5.583 | 4668.9 | bootstrap | - |
| windows-x86_64 | wasmc-tls-native-http | health | 8 | 14835.7 | 3.919 | 4917.0 | bootstrap | - |
| windows-x86_64 | native | health | 32 | 34891.9 | 1.180 | 9.3 | bootstrap | - |
| windows-x86_64 | wasmc-full | health | 32 | 11849.8 | 4.453 | 18732.0 | bootstrap | - |
| windows-x86_64 | wasmc-tls-native-http | health | 32 | 13753.0 | 8.842 | 18711.8 | bootstrap | - |

External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.
