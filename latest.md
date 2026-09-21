# WAsmC Host HTTPS paired A/B flywheel

Commit: e0202c8b3c67a344c63856356ff751820e21deae  
Measured: 2026-09-21T09:11:15.754Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.775 | 1.767 | 0.99x | 16 | 326590.0 | 377545.1 | 13.23% | 32->16 | PASS |
| linux-x86_64 | 1.377 | 1.377 | 0.99x | 16 | 127446.0 | 141563.7 | 11.42% | 32->16 | PASS |
| macos-aarch64 | 7.608 | 1767.116 | 51.18x | 16 | 138930.2 | 154310.8 | 11.34% | 32->16 | PASS |
| macos-x86_64 | 0.933 | 1.057 | 1.01x | 16 | 28238.9 | 34190.1 | 17.84% | 32->16 | PASS |
| windows-aarch64 | 1.699 | 1.704 | 1.00x | 8 | 77401.2 | 84147.4 | 7.28% | 32->8 | PASS |
| windows-x86_64 | 1.623 | 1.626 | 1.00x | 16 | 116042.0 | 139060.9 | 19.84% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
