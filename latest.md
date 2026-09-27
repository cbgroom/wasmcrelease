# WAsmC Host HTTPS paired A/B flywheel

Commit: 978d5866b51c538eb510e7e10a15486f4171d2e7  
Measured: 2026-09-27T02:23:53.382Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.796 | 1.791 | 1.00x | 16 | 309423.3 | 356278.4 | 15.14% | 32->16 | PASS |
| linux-x86_64 | 558.602 | 382.664 | 0.82x | 16 | 296256.4 | 361880.7 | 32.33% | 32->16 | PASS |
| macos-aarch64 | 1.759 | 1.881 | 1.10x | 1 | 110487.5 | 124804.8 | 4.19% | 32->1 | PASS |
| macos-x86_64 | 0.821 | 1.020 | 1.02x | 8 | 30347.3 | 41438.3 | 35.64% | 32->8 | PASS |
| windows-aarch64 | 1.742 | 1.735 | 0.99x | 4 | 81002.9 | 88336.0 | 9.05% | 32->4 | PASS |
| windows-x86_64 | 1.255 | 1.262 | 1.00x | 16 | 86912.8 | 96717.8 | 11.77% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
