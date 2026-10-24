# WAsmC external HTTPS load

Commit: e675229e181a4a801b1f06f8f0d8160e2772060f
Measured: 2026-10-24T17:58:32.760Z
Required platforms: linux-x86_64, linux-aarch64, macos-aarch64, windows-x86_64, windows-aarch64

| Platform | Lane | Workload | c | RPS p50 | p99 ms | prewarm ms | Baseline | RPS/base |
|---|---|---|---:|---:|---:|---:|---|---:|
| linux-aarch64 | native | health | 1 | 25137.8 | 0.048 | 2.0 | within-baseline | 1.05x |
| linux-aarch64 | wasmc-full | health | 1 | 11990.1 | 0.097 | 1010.9 | within-baseline | 1.00x |
| linux-aarch64 | wasmc-full | post-json | 1 | 9223.9 | 0.125 | 1017.9 | within-baseline | 0.99x |
| linux-aarch64 | wasmc-full | root-json | 1 | 10238.3 | 0.114 | 1014.4 | within-baseline | 1.00x |
| linux-aarch64 | wasmc-tls-native-http | health | 1 | 13409.0 | 0.086 | 1014.8 | within-baseline | 1.01x |
| linux-aarch64 | native | health | 8 | 91329.0 | 0.148 | 1.8 | within-baseline | 1.07x |
| linux-aarch64 | wasmc-full | health | 8 | 26611.3 | 0.650 | 2196.3 | within-baseline | 1.04x |
| linux-aarch64 | wasmc-full | post-json | 8 | 21626.1 | 0.848 | 2171.7 | within-baseline | 1.04x |
| linux-aarch64 | wasmc-full | root-json | 8 | 23575.7 | 0.863 | 2151.3 | within-baseline | 1.06x |
| linux-aarch64 | wasmc-tls-native-http | health | 8 | 31628.4 | 0.627 | 2204.0 | within-baseline | 1.01x |
| linux-aarch64 | native | health | 32 | 114198.8 | 1.309 | 1.9 | within-baseline | 1.02x |
| linux-aarch64 | wasmc-full | health | 32 | 32998.0 | 2.358 | 8648.0 | within-baseline | 1.02x |
| linux-aarch64 | wasmc-tls-native-http | health | 32 | 39899.5 | 2.056 | 8668.6 | within-baseline | 1.04x |
| linux-x86_64 | native | health | 1 | 32341.0 | 0.038 | 1.8 | within-baseline | 2.34x |
| linux-x86_64 | wasmc-full | health | 1 | 15921.4 | 0.073 | 785.0 | within-baseline | 2.47x |
| linux-x86_64 | wasmc-full | post-json | 1 | 13923.2 | 0.084 | 762.8 | within-baseline | 2.48x |
| linux-x86_64 | wasmc-full | root-json | 1 | 15120.2 | 0.075 | 766.8 | within-baseline | 2.48x |
| linux-x86_64 | wasmc-tls-native-http | health | 1 | 16509.1 | 0.067 | 779.2 | within-baseline | 2.27x |
| linux-x86_64 | native | health | 8 | 154441.9 | 0.091 | 1.8 | within-baseline | 2.34x |
| linux-x86_64 | wasmc-full | health | 8 | 44029.4 | 0.310 | 2331.2 | within-baseline | 2.10x |
| linux-x86_64 | wasmc-full | post-json | 8 | 36520.2 | 0.395 | 2305.5 | within-baseline | 2.17x |
| linux-x86_64 | wasmc-full | root-json | 8 | 39555.2 | 0.395 | 2239.1 | within-baseline | 2.13x |
| linux-x86_64 | wasmc-tls-native-http | health | 8 | 53160.0 | 0.259 | 2245.9 | within-baseline | 2.18x |
| linux-x86_64 | native | health | 32 | 155882.1 | 0.315 | 1.7 | within-baseline | 1.99x |
| linux-x86_64 | wasmc-full | health | 32 | 42403.1 | 1.525 | 9561.6 | within-baseline | 1.92x |
| linux-x86_64 | wasmc-tls-native-http | health | 32 | 50026.1 | 1.296 | 9361.6 | within-baseline | 1.94x |
| macos-aarch64 | native | health | 1 | 10244.2 | 0.192 | 4.4 | within-baseline | 1.16x |
| macos-aarch64 | wasmc-full | health | 1 | 6583.0 | 0.284 | 1017.9 | within-baseline | 0.96x |
| macos-aarch64 | wasmc-full | post-json | 1 | 6097.4 | 0.279 | 811.0 | within-baseline | 1.01x |
| macos-aarch64 | wasmc-full | root-json | 1 | 7763.4 | 0.276 | 842.4 | within-baseline | 1.32x |
| macos-aarch64 | wasmc-tls-native-http | health | 1 | 8018.6 | 0.253 | 943.2 | within-baseline | 1.33x |
| macos-aarch64 | native | health | 8 | 56582.0 | 0.615 | 2.8 | within-baseline | 1.19x |
| macos-aarch64 | wasmc-full | health | 8 | 17072.9 | 2.122 | 2537.7 | within-baseline | 0.82x |
| macos-aarch64 | wasmc-full | post-json | 8 | 18747.7 | 2.848 | 2373.9 | within-baseline | 1.26x |
| macos-aarch64 | wasmc-full | root-json | 8 | 17586.9 | 2.430 | 2196.5 | within-baseline | 0.95x |
| macos-aarch64 | wasmc-tls-native-http | health | 8 | 23018.9 | 1.522 | 2797.7 | within-baseline | 1.11x |
| macos-aarch64 | native | health | 32 | 69115.0 | 1.645 | 4.5 | within-baseline | 1.02x |
| macos-aarch64 | wasmc-full | health | 32 | 27309.7 | 8.191 | 9453.5 | within-baseline | 1.26x |
| macos-aarch64 | wasmc-tls-native-http | health | 32 | 28432.5 | 9.566 | 9896.8 | within-baseline | 1.29x |
| macos-x86_64 | native | health | 1 | 2193.3 | 1.352 | 7.0 | advisory-regression | 0.96x |
| macos-x86_64 | wasmc-full | health | 1 | 1437.7 | 1.848 | 2219.6 | advisory-regression | 0.91x |
| macos-x86_64 | wasmc-full | post-json | 1 | 1380.1 | 1.673 | 2260.5 | advisory-regression | 0.97x |
| macos-x86_64 | wasmc-full | root-json | 1 | 1506.1 | 1.638 | 2851.6 | advisory-regression | 1.06x |
| macos-x86_64 | wasmc-tls-native-http | health | 1 | 1511.1 | 1.538 | 2131.5 | advisory-regression | 1.18x |
| macos-x86_64 | native | health | 8 | 10202.0 | 4.534 | 6.9 | advisory-regression | 0.87x |
| macos-x86_64 | wasmc-full | health | 8 | 5438.9 | 5.163 | 6663.2 | advisory-regression | 0.99x |
| macos-x86_64 | wasmc-full | post-json | 8 | 4316.9 | 6.940 | 6934.9 | within-baseline | 0.85x |
| macos-x86_64 | wasmc-full | root-json | 8 | 5992.0 | 6.017 | 6597.7 | within-baseline | 1.20x |
| macos-x86_64 | wasmc-tls-native-http | health | 8 | 6423.0 | 4.272 | 6412.7 | within-baseline | 0.98x |
| macos-x86_64 | native | health | 32 | 15675.5 | 12.718 | 9.5 | advisory-regression | 0.65x |
| macos-x86_64 | wasmc-full | health | 32 | 6049.1 | 132.936 | 22282.5 | within-baseline | 0.92x |
| macos-x86_64 | wasmc-tls-native-http | health | 32 | 7366.3 | 131.097 | 23721.0 | within-baseline | 1.20x |
| windows-aarch64 | native | health | 1 | 8944.4 | 0.143 | 11.1 | within-baseline | 1.04x |
| windows-aarch64 | wasmc-full | health | 1 | 4462.7 | 0.248 | 1147.2 | within-baseline | 1.05x |
| windows-aarch64 | wasmc-full | post-json | 1 | 4008.6 | 0.291 | 1140.2 | within-baseline | 1.03x |
| windows-aarch64 | wasmc-full | root-json | 1 | 4081.8 | 0.275 | 1137.0 | within-baseline | 1.02x |
| windows-aarch64 | wasmc-tls-native-http | health | 1 | 4990.6 | 0.217 | 1146.1 | within-baseline | 1.02x |
| windows-aarch64 | native | health | 8 | 28638.8 | 0.717 | 10.4 | within-baseline | 0.90x |
| windows-aarch64 | wasmc-full | health | 8 | 13518.8 | 5.821 | 2467.7 | within-baseline | 0.97x |
| windows-aarch64 | wasmc-full | post-json | 8 | 12049.2 | 7.254 | 2510.1 | within-baseline | 1.00x |
| windows-aarch64 | wasmc-full | root-json | 8 | 12265.9 | 6.300 | 2474.7 | within-baseline | 0.99x |
| windows-aarch64 | wasmc-tls-native-http | health | 8 | 15036.0 | 4.612 | 2486.0 | within-baseline | 0.99x |
| windows-aarch64 | native | health | 32 | 33193.8 | 1.728 | 10.8 | within-baseline | 0.91x |
| windows-aarch64 | wasmc-full | health | 32 | 14200.5 | 61.342 | 9994.4 | advisory-regression | 0.96x |
| windows-aarch64 | wasmc-tls-native-http | health | 32 | 17157.2 | 18.917 | 9965.8 | within-baseline | 1.03x |
| windows-x86_64 | native | health | 1 | 33331.9 | 0.043 | 7.0 | within-baseline | 2.65x |
| windows-x86_64 | wasmc-full | health | 1 | 14364.5 | 0.093 | 954.6 | within-baseline | 2.40x |
| windows-x86_64 | wasmc-full | post-json | 1 | 12475.4 | 0.105 | 966.6 | within-baseline | 2.62x |
| windows-x86_64 | wasmc-full | root-json | 1 | 13088.5 | 0.099 | 953.5 | within-baseline | 2.50x |
| windows-x86_64 | wasmc-tls-native-http | health | 1 | 15074.1 | 0.089 | 951.5 | within-baseline | 2.27x |
| windows-x86_64 | native | health | 8 | 88025.8 | 0.149 | 6.6 | within-baseline | 3.03x |
| windows-x86_64 | wasmc-full | health | 8 | 36336.5 | 0.795 | 2597.8 | within-baseline | 2.66x |
| windows-x86_64 | wasmc-full | post-json | 8 | 29084.9 | 1.007 | 2579.1 | within-baseline | 2.63x |
| windows-x86_64 | wasmc-full | root-json | 8 | 26993.2 | 2.289 | 2572.6 | within-baseline | 2.23x |
| windows-x86_64 | wasmc-tls-native-http | health | 8 | 37365.6 | 0.649 | 2627.5 | within-baseline | 2.53x |
| windows-x86_64 | native | health | 32 | 93439.1 | 0.460 | 6.7 | within-baseline | 2.75x |
| windows-x86_64 | wasmc-full | health | 32 | 35540.4 | 9.146 | 10238.8 | within-baseline | 2.51x |
| windows-x86_64 | wasmc-tls-native-http | health | 32 | 37523.8 | 1.742 | 10198.8 | within-baseline | 2.24x |

External client load uses oha against real loopback TLS sockets. Timing is same-platform observational evidence; expected status and required-platform presence are hard gates.
