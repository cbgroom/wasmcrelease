# WAsmC Host HTTPS paired A/B flywheel

Commit: 2e9df145d1179784c137b599374c3dcb112bf826  
Measured: 2026-09-29T09:45:05.103Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.799 | 1.815 | 1.01x | 8 | 325453.4 | 350679.3 | 19.99% | 32->8 | PASS |
| linux-x86_64 | 1.368 | 1.332 | 0.97x | 16 | 129191.9 | 142475.9 | 9.70% | 32->16 | PASS |
| macos-aarch64 | 1.605 | 1.623 | 0.99x | 16 | 109765.1 | 81553.9 | 2.57% | 32->16 | PASS |
| macos-x86_64 | 0.813 | 0.852 | 1.02x | 16 | 33837.3 | 42938.8 | 26.15% | 32->16 | PASS |
| windows-aarch64 | 1.729 | 1.738 | 1.00x | 8 | 79912.2 | 86755.2 | 9.49% | 32->8 | PASS |
| windows-x86_64 | 1.270 | 1.263 | 0.99x | 16 | 70810.4 | 78078.9 | 11.57% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
