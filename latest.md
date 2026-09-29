# WAsmC Host HTTPS paired A/B flywheel

Commit: c49bfcd5971fdd3780303b61378e5a1f2502a45d  
Measured: 2026-09-29T21:02:32.732Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.799 | 1.794 | 1.00x | 16 | 321064.7 | 354064.8 | 10.28% | 32->16 | PASS |
| linux-x86_64 | 1.363 | 1.380 | 1.00x | 16 | 126930.9 | 142217.2 | 12.29% | 32->16 | PASS |
| macos-aarch64 | 1.801 | 1.919 | 1.10x | 2 | 134399.2 | 120675.7 | -2.00% | 32->2 | PASS |
| macos-x86_64 | 0.681 | 0.636 | 0.97x | 16 | 22793.7 | 37935.2 | 45.71% | 32->16 | PASS |
| windows-aarch64 | 1.700 | 1.732 | 1.01x | 8 | 77387.5 | 85065.9 | 10.34% | 32->8 | PASS |
| windows-x86_64 | 1.276 | 1.286 | 1.00x | 16 | 70599.8 | 80399.3 | 11.54% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
