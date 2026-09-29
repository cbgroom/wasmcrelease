# WAsmC external HTTPS load

Commit: bb119566b100d49611d4a199fc9595e5aabba526
Measured: 2026-09-29T04:29:54.481Z
Required platforms: linux-x86_64, linux-aarch64, macos-aarch64, windows-x86_64, windows-aarch64

| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |
|---|---|---|---:|---:|---:|---:|---|---:|
| linux-aarch64 | native | health | 1 | 24267.8 | 0.048 | 2.1 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-full | health | 1 | 12058.9 | 0.098 | 1011.4 | within-baseline | 0.98x |
| linux-aarch64 | wasmc-full | post-json | 1 | 9375.0 | 0.123 | 1007.7 | within-baseline | 1.01x |
| linux-aarch64 | wasmc-full | root-json | 1 | 10181.4 | 0.114 | 1013.7 | within-baseline | 0.95x |
| linux-aarch64 | wasmc-tls-native-http | health | 1 | 13245.0 | 0.081 | 1012.3 | within-baseline | 0.99x |
| linux-aarch64 | native | health | 8 | 93337.8 | 0.136 | 2.0 | within-baseline | 1.10x |
| linux-aarch64 | wasmc-full | health | 8 | 26500.7 | 0.778 | 2129.3 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-full | post-json | 8 | 20911.2 | 0.761 | 2183.4 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-full | root-json | 8 | 23040.2 | 0.796 | 2172.3 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-tls-native-http | health | 8 | 33237.2 | 0.479 | 2207.4 | within-baseline | 1.03x |
| linux-aarch64 | native | health | 32 | 112191.2 | 1.044 | 2.0 | within-baseline | 0.98x |
| linux-aarch64 | wasmc-full | health | 32 | 32496.8 | 2.238 | 8704.2 | within-baseline | 0.97x |
| linux-aarch64 | wasmc-tls-native-http | health | 32 | 38405.9 | 1.792 | 8662.1 | within-baseline | 0.92x |
| linux-x86_64 | native | health | 1 | 13758.9 | 0.083 | 2.1 | within-baseline | 0.98x |
| linux-x86_64 | wasmc-full | health | 1 | 6598.3 | 0.165 | 1342.5 | within-baseline | 0.98x |
| linux-x86_64 | wasmc-full | post-json | 1 | 5612.9 | 0.191 | 1346.7 | within-baseline | 0.98x |
| linux-x86_64 | wasmc-full | root-json | 1 | 6074.7 | 0.181 | 1347.6 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-tls-native-http | health | 1 | 7165.2 | 0.150 | 1354.3 | within-baseline | 0.96x |
| linux-x86_64 | native | health | 8 | 66916.6 | 0.170 | 2.0 | within-baseline | 1.00x |
| linux-x86_64 | wasmc-full | health | 8 | 21098.9 | 0.654 | 4108.2 | within-baseline | 0.99x |
| linux-x86_64 | wasmc-full | post-json | 8 | 17041.5 | 0.877 | 4076.2 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-full | root-json | 8 | 18420.4 | 0.821 | 4065.6 | within-baseline | 0.97x |
| linux-x86_64 | wasmc-tls-native-http | health | 8 | 25017.4 | 0.526 | 4086.4 | within-baseline | 1.04x |
| linux-x86_64 | native | health | 32 | 78388.0 | 0.644 | 2.0 | within-baseline | 1.01x |
| linux-x86_64 | wasmc-full | health | 32 | 22683.5 | 2.748 | 16723.2 | within-baseline | 1.00x |
| linux-x86_64 | wasmc-tls-native-http | health | 32 | 25345.5 | 2.481 | 16759.5 | within-baseline | 0.98x |
| macos-aarch64 | native | health | 1 | 8130.8 | 0.334 | 5.9 | advisory-regression | 0.64x |
| macos-aarch64 | wasmc-full | health | 1 | 7161.5 | 0.206 | 1001.6 | within-baseline | 0.98x |
| macos-aarch64 | wasmc-full | post-json | 1 | 5866.4 | 0.388 | 1138.8 | within-baseline | 0.90x |
| macos-aarch64 | wasmc-full | root-json | 1 | 7221.4 | 0.316 | 932.0 | advisory-regression | 1.00x |
| macos-aarch64 | wasmc-tls-native-http | health | 1 | 6533.9 | 0.418 | 1103.8 | advisory-regression | 0.75x |
| macos-aarch64 | native | health | 8 | 45493.3 | 0.795 | 4.2 | advisory-regression | 0.87x |
| macos-aarch64 | wasmc-full | health | 8 | 13934.1 | 3.744 | 2934.0 | advisory-regression | 0.58x |
| macos-aarch64 | wasmc-full | post-json | 8 | 15289.1 | 3.581 | 2615.6 | advisory-regression | 0.73x |
| macos-aarch64 | wasmc-full | root-json | 8 | 20503.1 | 2.929 | 2366.5 | within-baseline | 1.03x |
| macos-aarch64 | wasmc-tls-native-http | health | 8 | 20678.4 | 2.204 | 2945.0 | advisory-regression | 0.83x |
| macos-aarch64 | native | health | 32 | 56741.0 | 3.371 | 5.0 | advisory-regression | 0.74x |
| macos-aarch64 | wasmc-full | health | 32 | 23297.2 | 8.051 | 8859.3 | within-baseline | 0.88x |
| macos-aarch64 | wasmc-tls-native-http | health | 32 | 23136.7 | 8.368 | 10418.0 | within-baseline | 0.94x |
| macos-x86_64 | native | health | 1 | 2597.7 | 0.546 | 4.7 | within-baseline | 0.87x |
| macos-x86_64 | wasmc-full | health | 1 | 1686.3 | 0.744 | 1508.6 | within-baseline | 0.87x |
| macos-x86_64 | wasmc-full | post-json | 1 | 1419.7 | 1.519 | 1365.5 | within-baseline | 0.97x |
| macos-x86_64 | wasmc-full | root-json | 1 | 1203.0 | 0.621 | 1390.9 | advisory-regression | 0.72x |
| macos-x86_64 | wasmc-tls-native-http | health | 1 | 1276.8 | 0.512 | 1476.2 | advisory-regression | 0.69x |
| macos-x86_64 | native | health | 8 | 15030.9 | 0.954 | 4.9 | within-baseline | 1.24x |
| macos-x86_64 | wasmc-full | health | 8 | 5330.0 | 3.301 | 3689.2 | within-baseline | 0.85x |
| macos-x86_64 | wasmc-full | post-json | 8 | 7002.8 | 5.486 | 3316.9 | within-baseline | 0.91x |
| macos-x86_64 | wasmc-full | root-json | 8 | 6636.1 | 4.754 | 3537.4 | within-baseline | 1.08x |
| macos-x86_64 | wasmc-tls-native-http | health | 8 | 8319.7 | 3.612 | 3360.3 | within-baseline | 0.99x |
| macos-x86_64 | native | health | 32 | 23161.4 | 2.726 | 4.5 | advisory-regression | 0.76x |
| macos-x86_64 | wasmc-full | health | 32 | 10657.7 | 35.062 | 14235.3 | within-baseline | 1.50x |
| macos-x86_64 | wasmc-tls-native-http | health | 32 | 8178.5 | 54.286 | 13826.3 | within-baseline | 1.07x |
| windows-aarch64 | native | health | 1 | 8890.3 | 0.135 | 10.7 | within-baseline | 1.01x |
| windows-aarch64 | wasmc-full | health | 1 | 4700.6 | 0.242 | 1102.0 | within-baseline | 1.03x |
| windows-aarch64 | wasmc-full | post-json | 1 | 4065.7 | 0.280 | 1115.3 | within-baseline | 0.98x |
| windows-aarch64 | wasmc-full | root-json | 1 | 4311.3 | 0.265 | 1114.4 | within-baseline | 1.05x |
| windows-aarch64 | wasmc-tls-native-http | health | 1 | 5256.6 | 0.202 | 1133.2 | within-baseline | 1.02x |
| windows-aarch64 | native | health | 8 | 33655.0 | 0.699 | 10.2 | within-baseline | 1.03x |
| windows-aarch64 | wasmc-full | health | 8 | 13489.7 | 5.597 | 2393.2 | within-baseline | 0.95x |
| windows-aarch64 | wasmc-full | post-json | 8 | 13234.3 | 6.009 | 2364.2 | within-baseline | 1.05x |
| windows-aarch64 | wasmc-full | root-json | 8 | 13727.9 | 5.615 | 2379.6 | within-baseline | 1.10x |
| windows-aarch64 | wasmc-tls-native-http | health | 8 | 16314.3 | 3.494 | 2405.7 | within-baseline | 1.04x |
| windows-aarch64 | native | health | 32 | 39359.8 | 1.593 | 9.9 | within-baseline | 1.04x |
| windows-aarch64 | wasmc-full | health | 32 | 15881.9 | 19.119 | 9601.5 | within-baseline | 1.05x |
| windows-aarch64 | wasmc-tls-native-http | health | 32 | 16111.5 | 13.793 | 9841.2 | within-baseline | 0.94x |
| windows-x86_64 | native | health | 1 | 13099.2 | 0.114 | 11.2 | within-baseline | 1.01x |
| windows-x86_64 | wasmc-full | health | 1 | 4616.1 | 0.233 | 1545.5 | advisory-regression | 0.75x |
| windows-x86_64 | wasmc-full | post-json | 1 | 3886.2 | 0.263 | 1589.5 | advisory-regression | 0.77x |
| windows-x86_64 | wasmc-full | root-json | 1 | 4310.3 | 0.250 | 1574.7 | advisory-regression | 0.79x |
| windows-x86_64 | wasmc-tls-native-http | health | 1 | 4844.5 | 0.212 | 1560.7 | advisory-regression | 0.72x |
| windows-x86_64 | native | health | 8 | 25633.6 | 0.444 | 9.8 | within-baseline | 0.83x |
| windows-x86_64 | wasmc-full | health | 8 | 10849.6 | 5.888 | 4773.3 | within-baseline | 0.81x |
| windows-x86_64 | wasmc-full | post-json | 8 | 9051.9 | 6.315 | 4683.7 | within-baseline | 0.81x |
| windows-x86_64 | wasmc-full | root-json | 8 | 9154.6 | 5.891 | 4678.7 | advisory-regression | 0.75x |
| windows-x86_64 | wasmc-tls-native-http | health | 8 | 12769.8 | 4.520 | 4684.9 | within-baseline | 0.85x |
| windows-x86_64 | native | health | 32 | 31245.0 | 1.227 | 9.4 | within-baseline | 0.91x |
| windows-x86_64 | wasmc-full | health | 32 | 12918.2 | 10.706 | 18833.0 | within-baseline | 0.90x |
| windows-x86_64 | wasmc-tls-native-http | health | 32 | 13253.0 | 3.521 | 18678.4 | within-baseline | 0.96x |

External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.
