# WAsmC Host HTTPS paired A/B flywheel

Commit: 7f54fe1a54f6a52de0887da88747f0c564fb4c73  
Measured: 2026-09-29T20:23:56.773Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.770 | 1.773 | 1.00x | 16 | 329130.7 | 355004.9 | 11.65% | 32->16 | PASS |
| linux-x86_64 | 1.336 | 1.340 | 1.00x | 16 | 129179.6 | 141594.2 | 9.61% | 32->16 | PASS |
| macos-aarch64 | 1.614 | 1.637 | 1.05x | 16 | 72296.1 | 76177.4 | 5.37% | 32->16 | PASS |
| macos-x86_64 | 0.584 | 0.598 | 0.91x | 4 | 26553.0 | 38131.7 | 41.36% | 32->4 | PASS |
| windows-aarch64 | 1.707 | 1.706 | 1.00x | 8 | 79348.4 | 85778.8 | 8.79% | 32->8 | PASS |
| windows-x86_64 | 1.526 | 1.557 | 1.01x | 16 | 93309.8 | 95282.1 | 9.94% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
