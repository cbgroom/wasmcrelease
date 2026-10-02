# WAsmC Host HTTPS paired A/B flywheel

Commit: bbf13a1005969962e12223bc2f20bd84d8d5f130  
Measured: 2026-10-02T08:47:50.705Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.762 | 1.760 | 1.00x | 8 | 303712.8 | 339834.4 | 11.89% | 32->8 | PASS |
| linux-x86_64 | 1.689 | 1.699 | 1.00x | 2 | 171917.6 | 198549.8 | 15.49% | 32->2 | PASS |
| macos-aarch64 | 24.169 | 2284.382 | 82.73x | 4 | 130654.8 | 134229.2 | 2.74% | 32->4 | PASS |
| macos-x86_64 | 0.641 | 0.702 | 1.02x | 8 | 27671.0 | 35263.7 | 65.02% | 32->8 | PASS |
| windows-aarch64 | 1.732 | 1.738 | 1.00x | 4 | 81883.2 | 89239.9 | 8.98% | 32->4 | PASS |
| windows-x86_64 | 1.254 | 1.257 | 1.00x | 16 | 86036.8 | 97559.9 | 13.73% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
