# WAsmC Host HTTPS paired A/B flywheel

Commit: 923e8bc5ede22d8bc4e2859a04f3efb3e23bdc6d  
Measured: 2026-09-21T18:53:31.439Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.772 | 1.773 | 1.00x | 16 | 315526.6 | 369872.9 | 18.78% | 32->16 | PASS |
| linux-x86_64 | 1.378 | 1.340 | 0.99x | 2 | 127832.6 | 143746.4 | 12.02% | 32->2 | PASS |
| macos-aarch64 | 12.753 | 783.064 | 32.48x | 4 | 91688.6 | 79798.1 | -13.82% | 32->4 | PASS |
| macos-x86_64 | 0.978 | 1.113 | 0.99x | 8 | 29528.6 | 40942.1 | 40.23% | 32->8 | PASS |
| windows-aarch64 | 1.696 | 1.688 | 0.99x | 8 | 78957.0 | 86410.7 | 9.82% | 32->8 | PASS |
| windows-x86_64 | 1.269 | 1.263 | 1.00x | 16 | 89469.2 | 105297.1 | 17.69% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
