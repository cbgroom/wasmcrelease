# WAsmC Host HTTPS paired A/B flywheel

Commit: 943676f64ef50a2e35f3cd3b0c35525b989030b3  
Measured: 2026-09-27T04:25:35.047Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.756 | 1.815 | 1.01x | 8 | 326529.3 | 364098.1 | 11.40% | 32->8 | PASS |
| linux-x86_64 | 1.480 | 1.490 | 1.00x | 8 | 233986.2 | 243551.3 | 4.09% | 32->8 | PASS |
| macos-aarch64 | 48.399 | 3090.302 | 39.55x | 4 | 142863.9 | 139579.7 | 1.69% | 32->4 | PASS |
| macos-x86_64 | 1.134 | 1.102 | 0.95x | 4 | 28837.4 | 42068.9 | 45.89% | 32->4 | PASS |
| windows-aarch64 | 1.647 | 1.648 | 1.00x | 4 | 74821.7 | 83105.4 | 11.64% | 32->4 | PASS |
| windows-x86_64 | 1.277 | 1.277 | 1.00x | 16 | 76607.3 | 84185.1 | 12.32% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
