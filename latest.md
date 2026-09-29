# WAsmC Host HTTPS paired A/B flywheel

Commit: 63ca6c05515de93d6a8d9f8825807313ef882cf7  
Measured: 2026-09-29T15:53:40.290Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.756 | 1.771 | 1.01x | 16 | 300047.5 | 363463.5 | 21.07% | 32->16 | PASS |
| linux-x86_64 | 1.372 | 1.370 | 1.00x | 16 | 126795.7 | 140044.7 | 9.55% | 32->16 | PASS |
| macos-aarch64 | 1.766 | 1.812 | 1.18x | 2 | 85862.0 | 100594.9 | 20.15% | 32->2 | PASS |
| macos-x86_64 | 0.600 | 0.578 | 0.86x | 4 | 26918.9 | 34108.6 | 30.69% | 32->4 | PASS |
| windows-aarch64 | 1.715 | 1.738 | 1.01x | 8 | 78450.5 | 86219.8 | 11.84% | 32->8 | PASS |
| windows-x86_64 | 1.326 | 1.316 | 0.99x | 16 | 75737.6 | 81180.1 | 9.42% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
