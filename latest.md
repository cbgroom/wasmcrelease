# WAsmC external HTTPS load

Commit: 29c474c26c65fe4517098b3145da544224e9027f
Measured: 2026-09-27T03:23:15.679Z
Required platforms: linux-x86_64, linux-aarch64, macos-aarch64, windows-x86_64, windows-aarch64

| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |
|---|---|---|---:|---:|---:|---:|---|---:|
| linux-aarch64 | native | health | 1 | 25297.6 | 0.046 | 1.8 | within-baseline | 1.05x |
| linux-aarch64 | wasmc-full | health | 1 | 12329.3 | 0.095 | 1001.6 | within-baseline | 1.03x |
| linux-aarch64 | wasmc-full | post-json | 1 | 9969.6 | 0.117 | 992.7 | within-baseline | 1.12x |
| linux-aarch64 | wasmc-full | root-json | 1 | 10905.4 | 0.108 | 1011.4 | within-baseline | 1.02x |
| linux-aarch64 | wasmc-tls-native-http | health | 1 | 13900.9 | 0.082 | 1000.3 | within-baseline | 1.05x |
| linux-aarch64 | native | health | 8 | 82010.6 | 0.165 | 1.8 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-full | health | 8 | 29251.3 | 0.766 | 2125.8 | within-baseline | 1.18x |
| linux-aarch64 | wasmc-full | post-json | 8 | 23285.8 | 0.741 | 2129.6 | within-baseline | 1.17x |
| linux-aarch64 | wasmc-full | root-json | 8 | 25099.1 | 0.848 | 2134.3 | within-baseline | 1.20x |
| linux-aarch64 | wasmc-tls-native-http | health | 8 | 33525.1 | 0.598 | 2111.3 | within-baseline | 1.12x |
| linux-aarch64 | native | health | 32 | 118362.7 | 1.225 | 1.8 | advisory-regression | 1.10x |
| linux-aarch64 | wasmc-full | health | 32 | 36087.1 | 2.044 | 8345.6 | within-baseline | 1.16x |
| linux-aarch64 | wasmc-tls-native-http | health | 32 | 42261.2 | 1.642 | 8312.7 | within-baseline | 1.11x |
| linux-x86_64 | native | health | 1 | 14019.2 | 0.088 | 2.1 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-full | health | 1 | 6755.4 | 0.164 | 1350.8 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-full | post-json | 1 | 5726.6 | 0.191 | 1349.9 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-full | root-json | 1 | 5985.2 | 0.182 | 1353.2 | within-baseline | 0.99x |
| linux-x86_64 | wasmc-tls-native-http | health | 1 | 7349.0 | 0.152 | 1346.9 | within-baseline | 0.99x |
| linux-x86_64 | native | health | 8 | 62404.1 | 0.189 | 2.2 | within-baseline | 0.93x |
| linux-x86_64 | wasmc-full | health | 8 | 21333.2 | 0.621 | 4131.9 | within-baseline | 1.02x |
| linux-x86_64 | wasmc-full | post-json | 8 | 16637.3 | 0.929 | 4118.7 | within-baseline | 0.98x |
| linux-x86_64 | wasmc-full | root-json | 8 | 18533.4 | 0.794 | 4105.2 | within-baseline | 0.98x |
| linux-x86_64 | wasmc-tls-native-http | health | 8 | 23934.2 | 0.619 | 4162.2 | within-baseline | 1.00x |
| linux-x86_64 | native | health | 32 | 77362.4 | 0.623 | 2.2 | within-baseline | 1.00x |
| linux-x86_64 | wasmc-full | health | 32 | 22117.7 | 2.849 | 16863.9 | within-baseline | 0.98x |
| linux-x86_64 | wasmc-tls-native-http | health | 32 | 25091.8 | 2.529 | 16871.3 | within-baseline | 0.97x |
| macos-aarch64 | native | health | 1 | 11932.1 | 0.106 | 5.2 | within-baseline | 0.95x |
| macos-aarch64 | wasmc-full | health | 1 | 7291.7 | 0.141 | 778.0 | within-baseline | 1.13x |
| macos-aarch64 | wasmc-full | post-json | 1 | 6536.4 | 0.151 | 783.8 | within-baseline | 1.15x |
| macos-aarch64 | wasmc-full | root-json | 1 | 7208.3 | 0.195 | 796.9 | within-baseline | 1.24x |
| macos-aarch64 | wasmc-tls-native-http | health | 1 | 7590.3 | 0.196 | 817.6 | within-baseline | 0.88x |
| macos-aarch64 | native | health | 8 | 54246.9 | 0.259 | 2.5 | within-baseline | 1.07x |
| macos-aarch64 | wasmc-full | health | 8 | 20141.3 | 1.444 | 2185.7 | within-baseline | 0.84x |
| macos-aarch64 | wasmc-full | post-json | 8 | 18057.1 | 1.383 | 2167.9 | within-baseline | 0.86x |
| macos-aarch64 | wasmc-full | root-json | 8 | 17846.0 | 1.703 | 2060.1 | within-baseline | 0.90x |
| macos-aarch64 | wasmc-tls-native-http | health | 8 | 26659.4 | 1.042 | 1996.5 | within-baseline | 1.18x |
| macos-aarch64 | native | health | 32 | 70312.4 | 1.888 | 2.2 | within-baseline | 0.92x |
| macos-aarch64 | wasmc-full | health | 32 | 20688.7 | 11.637 | 11911.6 | advisory-regression | 0.78x |
| macos-aarch64 | wasmc-tls-native-http | health | 32 | 24546.8 | 10.670 | 11541.7 | within-baseline | 1.00x |
| macos-x86_64 | native | health | 1 | 1917.6 | 0.949 | 10.4 | advisory-regression | 0.64x |
| macos-x86_64 | wasmc-full | health | 1 | 1048.2 | 1.586 | 3090.4 | advisory-regression | 0.54x |
| macos-x86_64 | wasmc-full | post-json | 1 | 993.0 | 1.354 | 1978.2 | advisory-regression | 0.68x |
| macos-x86_64 | wasmc-full | root-json | 1 | 1234.9 | 1.133 | 2366.9 | advisory-regression | 0.74x |
| macos-x86_64 | wasmc-tls-native-http | health | 1 | 1282.2 | 1.353 | 2956.0 | advisory-regression | 0.69x |
| macos-x86_64 | native | health | 8 | 9130.2 | 3.043 | 8.1 | advisory-regression | 0.75x |
| macos-x86_64 | wasmc-full | health | 8 | 4066.3 | 6.550 | 7277.4 | advisory-regression | 0.65x |
| macos-x86_64 | wasmc-full | post-json | 8 | 3581.7 | 10.377 | 7609.1 | advisory-regression | 0.47x |
| macos-x86_64 | wasmc-full | root-json | 8 | 4061.3 | 8.844 | 7143.2 | advisory-regression | 0.66x |
| macos-x86_64 | wasmc-tls-native-http | health | 8 | 4665.0 | 6.791 | 7893.5 | advisory-regression | 0.56x |
| macos-x86_64 | native | health | 32 | 17340.0 | 7.983 | 7.9 | advisory-regression | 0.57x |
| macos-x86_64 | wasmc-full | health | 32 | 4829.1 | 134.329 | 27800.0 | advisory-regression | 0.68x |
| macos-x86_64 | wasmc-tls-native-http | health | 32 | 5218.0 | 126.465 | 27347.1 | advisory-regression | 0.68x |
| windows-aarch64 | native | health | 1 | 9209.2 | 0.139 | 11.1 | within-baseline | 1.05x |
| windows-aarch64 | wasmc-full | health | 1 | 4562.4 | 0.234 | 1138.3 | within-baseline | 1.02x |
| windows-aarch64 | wasmc-full | post-json | 1 | 4159.7 | 0.273 | 1123.6 | within-baseline | 1.06x |
| windows-aarch64 | wasmc-full | root-json | 1 | 4344.0 | 0.263 | 1128.2 | within-baseline | 1.07x |
| windows-aarch64 | wasmc-tls-native-http | health | 1 | 5516.3 | 0.205 | 1125.3 | within-baseline | 1.09x |
| windows-aarch64 | native | health | 8 | 32529.4 | 0.705 | 10.0 | within-baseline | 1.04x |
| windows-aarch64 | wasmc-full | health | 8 | 14189.2 | 4.057 | 2369.0 | within-baseline | 1.00x |
| windows-aarch64 | wasmc-full | post-json | 8 | 12702.6 | 6.390 | 2378.7 | within-baseline | 1.03x |
| windows-aarch64 | wasmc-full | root-json | 8 | 12081.5 | 4.319 | 2418.3 | within-baseline | 0.97x |
| windows-aarch64 | wasmc-tls-native-http | health | 8 | 16189.3 | 3.316 | 2393.4 | within-baseline | 1.17x |
| windows-aarch64 | native | health | 32 | 37851.4 | 1.635 | 10.8 | within-baseline | 1.02x |
| windows-aarch64 | wasmc-full | health | 32 | 15381.4 | 21.702 | 9876.0 | within-baseline | 1.03x |
| windows-aarch64 | wasmc-tls-native-http | health | 32 | 12680.6 | 14.212 | 9883.4 | advisory-regression | 0.74x |
| windows-x86_64 | native | health | 1 | 12926.9 | 0.111 | 9.0 | within-baseline | 0.99x |
| windows-x86_64 | wasmc-full | health | 1 | 6191.6 | 0.230 | 1543.9 | within-baseline | 1.03x |
| windows-x86_64 | wasmc-full | post-json | 1 | 5037.8 | 0.261 | 1554.6 | within-baseline | 1.02x |
| windows-x86_64 | wasmc-full | root-json | 1 | 5465.2 | 0.245 | 1559.3 | within-baseline | 1.03x |
| windows-x86_64 | wasmc-tls-native-http | health | 1 | 6917.3 | 0.205 | 1541.8 | within-baseline | 1.07x |
| windows-x86_64 | native | health | 8 | 32018.1 | 0.403 | 9.0 | within-baseline | 1.04x |
| windows-x86_64 | wasmc-full | health | 8 | 13478.3 | 5.519 | 4601.7 | within-baseline | 1.03x |
| windows-x86_64 | wasmc-full | post-json | 8 | 10810.5 | 6.624 | 4573.8 | within-baseline | 0.97x |
| windows-x86_64 | wasmc-full | root-json | 8 | 13059.2 | 5.569 | 4531.3 | within-baseline | 1.11x |
| windows-x86_64 | wasmc-tls-native-http | health | 8 | 13914.6 | 3.294 | 4587.2 | within-baseline | 0.92x |
| windows-x86_64 | native | health | 32 | 32242.9 | 1.151 | 8.8 | within-baseline | 0.94x |
| windows-x86_64 | wasmc-full | health | 32 | 13664.1 | 9.880 | 18430.0 | advisory-regression | 0.95x |
| windows-x86_64 | wasmc-tls-native-http | health | 32 | 13440.7 | 5.807 | 18301.6 | advisory-regression | 0.97x |

External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.
