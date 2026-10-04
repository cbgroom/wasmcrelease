# WAsmC Host HTTPS paired A/B flywheel

Commit: 0d4f1f5085f134d8c9a3214d8e235c6ab08beed2  
Measured: 2026-10-04T19:41:37.868Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.784 | 1.796 | 1.01x | 16 | 343199.7 | 364354.9 | 11.17% | 32->16 | PASS |
| linux-x86_64 | 1.483 | 1.498 | 1.01x | 8 | 235356.1 | 257005.0 | 9.20% | 32->8 | PASS |
| macos-aarch64 | 29.402 | 1576.591 | 40.34x | 16 | 118023.0 | 124364.8 | 5.37% | 32->16 | PASS |
| macos-x86_64 | 1.002 | 1.049 | 1.01x | 8 | 31868.4 | 48087.6 | 50.89% | 32->8 | PASS |
| windows-aarch64 | 1.743 | 1.763 | 1.01x | 8 | 82173.0 | 89167.2 | 9.82% | 32->8 | PASS |
| windows-x86_64 | 1.292 | 1.301 | 1.00x | 16 | 72855.7 | 80226.7 | 10.17% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
