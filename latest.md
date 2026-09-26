# WAsmC external HTTPS load

Commit: b1d22d27bdc9727e607cf77a4af57b151df6832d
Measured: 2026-09-26T01:21:30.882Z
Required platforms: linux-x86_64, linux-aarch64, macos-aarch64, windows-x86_64, windows-aarch64

| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |
|---|---|---|---:|---:|---:|---:|---|---:|
| linux-aarch64 | native | health | 1 | 24395.0 | 0.047 | 2.0 | within-baseline | 1.01x |
| linux-aarch64 | wasmc-full | health | 1 | 12282.0 | 0.099 | 1012.7 | within-baseline | 1.03x |
| linux-aarch64 | wasmc-full | post-json | 1 | 9307.4 | 0.125 | 1022.6 | within-baseline | 1.04x |
| linux-aarch64 | wasmc-full | root-json | 1 | 10708.9 | 0.112 | 1014.1 | within-baseline | 1.01x |
| linux-aarch64 | wasmc-tls-native-http | health | 1 | 13429.4 | 0.087 | 1011.9 | within-baseline | 1.01x |
| linux-aarch64 | native | health | 8 | 86470.7 | 0.172 | 1.9 | within-baseline | 1.02x |
| linux-aarch64 | wasmc-full | health | 8 | 27338.0 | 0.582 | 2206.3 | within-baseline | 1.10x |
| linux-aarch64 | wasmc-full | post-json | 8 | 21482.8 | 0.781 | 2197.8 | within-baseline | 1.08x |
| linux-aarch64 | wasmc-full | root-json | 8 | 23194.3 | 0.837 | 2189.0 | within-baseline | 1.12x |
| linux-aarch64 | wasmc-tls-native-http | health | 8 | 32397.3 | 0.646 | 2158.0 | within-baseline | 1.08x |
| linux-aarch64 | native | health | 32 | 114417.2 | 0.863 | 1.9 | within-baseline | 1.09x |
| linux-aarch64 | wasmc-full | health | 32 | 33420.4 | 2.198 | 8601.2 | within-baseline | 1.08x |
| linux-aarch64 | wasmc-tls-native-http | health | 32 | 41555.5 | 1.888 | 8628.6 | within-baseline | 1.10x |
| linux-x86_64 | native | health | 1 | 20553.1 | 0.064 | 2.3 | within-baseline | 1.54x |
| linux-x86_64 | wasmc-full | health | 1 | 8974.4 | 0.139 | 1374.1 | within-baseline | 1.38x |
| linux-x86_64 | wasmc-full | post-json | 1 | 7113.1 | 0.171 | 1367.7 | within-baseline | 1.26x |
| linux-x86_64 | wasmc-full | root-json | 1 | 8010.2 | 0.156 | 1375.9 | within-baseline | 1.35x |
| linux-x86_64 | wasmc-tls-native-http | health | 1 | 9960.5 | 0.125 | 1369.3 | within-baseline | 1.37x |
| linux-x86_64 | native | health | 8 | 83320.4 | 0.115 | 2.2 | within-baseline | 1.27x |
| linux-x86_64 | wasmc-full | health | 8 | 24175.9 | 0.615 | 3990.4 | within-baseline | 1.16x |
| linux-x86_64 | wasmc-full | post-json | 8 | 18629.5 | 0.824 | 3943.2 | within-baseline | 1.10x |
| linux-x86_64 | wasmc-full | root-json | 8 | 20904.8 | 0.709 | 3934.2 | within-baseline | 1.14x |
| linux-x86_64 | wasmc-tls-native-http | health | 8 | 28871.0 | 0.509 | 3995.9 | within-baseline | 1.20x |
| linux-x86_64 | native | health | 32 | 91216.6 | 0.556 | 2.2 | within-baseline | 1.18x |
| linux-x86_64 | wasmc-full | health | 32 | 24975.5 | 2.524 | 16362.2 | within-baseline | 1.12x |
| linux-x86_64 | wasmc-tls-native-http | health | 32 | 28135.8 | 2.239 | 16290.1 | within-baseline | 1.10x |
| macos-aarch64 | native | health | 1 | 12617.0 | 0.158 | 8.4 | advisory-regression | 1.41x |
| macos-aarch64 | wasmc-full | health | 1 | 8819.9 | 0.205 | 828.2 | within-baseline | 1.50x |
| macos-aarch64 | wasmc-full | post-json | 1 | 6724.7 | 0.321 | 947.1 | within-baseline | 1.19x |
| macos-aarch64 | wasmc-full | root-json | 1 | 7813.3 | 0.226 | 960.2 | within-baseline | 1.57x |
| macos-aarch64 | wasmc-tls-native-http | health | 1 | 9857.4 | 0.198 | 865.2 | within-baseline | 1.56x |
| macos-aarch64 | native | health | 8 | 42582.2 | 0.596 | 3.5 | within-baseline | 0.82x |
| macos-aarch64 | wasmc-full | health | 8 | 29119.7 | 1.846 | 2260.5 | within-baseline | 1.77x |
| macos-aarch64 | wasmc-full | post-json | 8 | 21055.0 | 2.305 | 2193.9 | within-baseline | 0.98x |
| macos-aarch64 | wasmc-full | root-json | 8 | 24405.3 | 2.388 | 2223.9 | within-baseline | 1.23x |
| macos-aarch64 | wasmc-tls-native-http | health | 8 | 24885.2 | 1.080 | 2228.0 | within-baseline | 1.32x |
| macos-aarch64 | native | health | 32 | 75027.2 | 1.974 | 3.7 | within-baseline | 0.95x |
| macos-aarch64 | wasmc-full | health | 32 | 30473.3 | 7.114 | 8576.1 | within-baseline | 1.78x |
| macos-aarch64 | wasmc-tls-native-http | health | 32 | 27128.0 | 8.123 | 9502.0 | within-baseline | 1.31x |
| macos-x86_64 | native | health | 1 | 2134.4 | 0.607 | 5.5 | advisory-regression | 0.67x |
| macos-x86_64 | wasmc-full | health | 1 | 1288.4 | 1.468 | 1899.2 | advisory-regression | 0.57x |
| macos-x86_64 | wasmc-full | post-json | 1 | 1470.1 | 0.776 | 1865.8 | advisory-regression | 0.81x |
| macos-x86_64 | wasmc-full | root-json | 1 | 1322.1 | 0.804 | 2552.0 | advisory-regression | 0.60x |
| macos-x86_64 | wasmc-tls-native-http | health | 1 | 1473.1 | 0.963 | 1738.7 | advisory-regression | 0.61x |
| macos-x86_64 | native | health | 8 | 10807.7 | 1.283 | 5.9 | advisory-regression | 0.75x |
| macos-x86_64 | wasmc-full | health | 8 | 5008.6 | 7.450 | 6602.1 | advisory-regression | 0.54x |
| macos-x86_64 | wasmc-full | post-json | 8 | 3783.7 | 7.756 | 5530.3 | advisory-regression | 0.49x |
| macos-x86_64 | wasmc-full | root-json | 8 | 5395.9 | 7.121 | 6076.1 | advisory-regression | 0.88x |
| macos-x86_64 | wasmc-tls-native-http | health | 8 | 4924.8 | 6.552 | 5836.9 | advisory-regression | 0.53x |
| macos-x86_64 | native | health | 32 | 25763.6 | 4.671 | 6.4 | advisory-regression | 0.79x |
| macos-x86_64 | wasmc-full | health | 32 | 5843.1 | 141.305 | 24859.5 | advisory-regression | 0.68x |
| macos-x86_64 | wasmc-tls-native-http | health | 32 | 5401.5 | 132.576 | 25776.6 | advisory-regression | 0.59x |
| windows-aarch64 | native | health | 1 | 8800.9 | 0.151 | 11.1 | within-baseline | 1.00x |
| windows-aarch64 | wasmc-full | health | 1 | 4456.3 | 0.250 | 1133.5 | within-baseline | 0.96x |
| windows-aarch64 | wasmc-full | post-json | 1 | 3912.3 | 0.289 | 1131.3 | within-baseline | 0.93x |
| windows-aarch64 | wasmc-full | root-json | 1 | 4122.3 | 0.274 | 1126.6 | within-baseline | 1.02x |
| windows-aarch64 | wasmc-tls-native-http | health | 1 | 5055.0 | 0.221 | 1130.3 | within-baseline | 0.98x |
| windows-aarch64 | native | health | 8 | 31285.0 | 0.728 | 10.5 | within-baseline | 0.95x |
| windows-aarch64 | wasmc-full | health | 8 | 14389.6 | 3.324 | 2405.6 | within-baseline | 1.01x |
| windows-aarch64 | wasmc-full | post-json | 8 | 12380.5 | 6.920 | 2377.3 | within-baseline | 0.98x |
| windows-aarch64 | wasmc-full | root-json | 8 | 12429.6 | 4.711 | 2410.8 | within-baseline | 0.93x |
| windows-aarch64 | wasmc-tls-native-http | health | 8 | 15612.3 | 4.146 | 2403.4 | within-baseline | 1.14x |
| windows-aarch64 | native | health | 32 | 37272.3 | 1.558 | 10.8 | within-baseline | 0.97x |
| windows-aarch64 | wasmc-full | health | 32 | 15186.0 | 29.797 | 9819.0 | within-baseline | 1.01x |
| windows-aarch64 | wasmc-tls-native-http | health | 32 | 17099.1 | 16.344 | 10114.0 | within-baseline | 0.96x |
| windows-x86_64 | native | health | 1 | 13194.6 | 0.110 | 8.9 | within-baseline | 1.02x |
| windows-x86_64 | wasmc-full | health | 1 | 6139.9 | 0.244 | 1515.4 | within-baseline | 1.03x |
| windows-x86_64 | wasmc-full | post-json | 1 | 5116.2 | 0.259 | 1529.0 | within-baseline | 1.07x |
| windows-x86_64 | wasmc-full | root-json | 1 | 5425.6 | 0.245 | 1529.4 | within-baseline | 1.06x |
| windows-x86_64 | wasmc-tls-native-http | health | 1 | 6449.1 | 0.207 | 1530.7 | within-baseline | 0.96x |
| windows-x86_64 | native | health | 8 | 30930.2 | 0.419 | 8.7 | within-baseline | 1.00x |
| windows-x86_64 | wasmc-full | health | 8 | 13651.5 | 5.562 | 4534.6 | within-baseline | 1.05x |
| windows-x86_64 | wasmc-full | post-json | 8 | 11739.3 | 7.145 | 4516.8 | within-baseline | 1.05x |
| windows-x86_64 | wasmc-full | root-json | 8 | 11769.1 | 5.803 | 4517.5 | within-baseline | 1.10x |
| windows-x86_64 | wasmc-tls-native-http | health | 8 | 15097.6 | 3.808 | 4577.3 | within-baseline | 1.02x |
| windows-x86_64 | native | health | 32 | 34311.3 | 1.196 | 8.7 | within-baseline | 0.98x |
| windows-x86_64 | wasmc-full | health | 32 | 14580.4 | 4.041 | 18099.4 | within-baseline | 1.23x |
| windows-x86_64 | wasmc-tls-native-http | health | 32 | 14589.7 | 3.479 | 17937.5 | within-baseline | 1.06x |

External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.
