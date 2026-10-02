# WAsmC Host HTTPS paired A/B flywheel

Commit: 58446f7ce50da2cff8e447913d28dbacaa45dae6  
Measured: 2026-10-02T16:35:45.241Z  
Platforms: 5

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.793 | 1.795 | 1.00x | 16 | 331194.3 | 347911.5 | 6.07% | 32->16 | PASS |
| linux-x86_64 | 1.696 | 1.690 | 0.99x | 2 | 174043.9 | 195303.8 | 12.53% | 32->2 | PASS |
| macos-aarch64 | 1.750 | 1.751 | 1.00x | 2 | 128007.6 | 123156.2 | -3.79% | 32->2 | PASS |
| windows-aarch64 | 1.725 | 1.750 | 1.01x | 8 | 81261.2 | 88557.5 | 11.12% | 32->8 | PASS |
| windows-x86_64 | 1.277 | 1.279 | 1.00x | 16 | 73108.2 | 79870.9 | 10.55% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
