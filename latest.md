# WAsmC Host HTTPS paired A/B flywheel

Commit: 735cc7fea762ba76f96d443cf64e47a31f8a1cc6  
Measured: 2026-09-21T19:16:15.928Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.793 | 1.807 | 1.00x | 16 | 325006.8 | 376196.0 | 16.73% | 32->16 | PASS |
| linux-x86_64 | 1.689 | 1.702 | 1.00x | 16 | 171129.7 | 191036.6 | 11.60% | 32->16 | PASS |
| macos-aarch64 | 8.622 | 1144.408 | 48.02x | 2 | 139432.8 | 142449.6 | 2.16% | 32->2 | PASS |
| macos-x86_64 | 1.359 | 1.411 | 1.03x | 4 | 43381.6 | 58368.5 | 45.10% | 32->4 | PASS |
| windows-aarch64 | 1.781 | 1.776 | 1.00x | 4 | 85182.6 | 92380.7 | 10.32% | 32->4 | PASS |
| windows-x86_64 | 1.336 | 1.333 | 1.00x | 16 | 86454.1 | 91984.9 | 6.22% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
