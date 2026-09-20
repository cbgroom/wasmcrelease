# WAsmC Host HTTPS paired A/B flywheel

Commit: f81b598f11198e0d801ec21dd95d585ff495953b  
Measured: 2026-09-20T17:21:33.157Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.790 | 1.796 | 1.00x | 16 | 331201.5 | 347665.9 | 12.95% | 32->16 | PASS |
| linux-x86_64 | 1.320 | 1.326 | 1.00x | 16 | 125766.8 | 141590.2 | 10.79% | 32->16 | PASS |
| macos-aarch64 | 1.530 | 1.663 | 1.09x | 8 | 77561.2 | 88313.1 | 12.06% | 32->8 | PASS |
| macos-x86_64 | 1.035 | 1.004 | 0.97x | 8 | 32760.7 | 41731.8 | 34.19% | 32->8 | PASS |
| windows-aarch64 | 1.709 | 1.714 | 1.00x | 4 | 75495.2 | 83682.9 | 9.56% | 32->4 | PASS |
| windows-x86_64 | 1.302 | 1.299 | 0.99x | 16 | 71247.2 | 81549.4 | 14.46% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
