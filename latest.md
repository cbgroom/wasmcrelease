# WAsmC Host HTTPS paired A/B flywheel

Commit: abb99795c9c89d2fb3778d2bed7fa2494862fd71  
Measured: 2026-10-02T09:13:15.966Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.784 | 1.781 | 1.00x | 16 | 318363.2 | 378259.2 | 21.10% | 32->16 | PASS |
| linux-x86_64 | 1.319 | 1.343 | 1.00x | 2 | 127395.8 | 141389.8 | 14.09% | 32->2 | PASS |
| macos-aarch64 | 1.597 | 1.638 | 0.89x | 2 | 70046.1 | 67908.9 | 5.61% | 32->2 | PASS |
| macos-x86_64 | 1.298 | 1.279 | 0.96x | 8 | 32555.5 | 40711.0 | 39.04% | 32->8 | PASS |
| windows-aarch64 | 1.727 | 1.735 | 1.01x | 8 | 79406.8 | 85127.4 | 7.83% | 32->8 | PASS |
| windows-x86_64 | 1.231 | 1.245 | 1.00x | 16 | 84934.1 | 97279.7 | 14.54% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
