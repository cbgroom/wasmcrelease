# WAsmC Host HTTPS paired A/B flywheel

Commit: 83c9511be282c36f3dc3789517dc4a4995e0d493  
Measured: 2026-10-02T07:58:56.178Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.768 | 1.754 | 0.99x | 4 | 287191.9 | 334549.7 | 10.45% | 32->4 | PASS |
| linux-x86_64 | 1.356 | 1.356 | 1.00x | 4 | 134309.0 | 143943.8 | 10.11% | 32->4 | PASS |
| macos-aarch64 | 1.896 | 1.859 | 1.10x | 4 | 70301.5 | 89152.3 | 17.75% | 32->4 | PASS |
| macos-x86_64 | 0.560 | 0.611 | 1.00x | 8 | 22996.7 | 32116.2 | 36.65% | 32->8 | PASS |
| windows-aarch64 | 1.662 | 1.676 | 1.00x | 4 | 78263.0 | 86319.3 | 9.63% | 32->4 | PASS |
| windows-x86_64 | 1.613 | 1.614 | 1.00x | 16 | 108717.7 | 130684.1 | 20.48% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
