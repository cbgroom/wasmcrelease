# WAsmC Host HTTPS paired A/B flywheel

Commit: b1d22d27bdc9727e607cf77a4af57b151df6832d  
Measured: 2026-09-26T01:21:25.036Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.795 | 1.796 | 1.00x | 16 | 307939.8 | 357800.9 | 16.21% | 32->16 | PASS |
| linux-x86_64 | 1.409 | 1.369 | 0.97x | 16 | 127769.1 | 143656.1 | 15.20% | 32->16 | PASS |
| macos-aarch64 | 40.266 | 2552.452 | 57.65x | 4 | 135322.6 | 138226.6 | 1.31% | 32->4 | PASS |
| macos-x86_64 | 0.764 | 0.846 | 1.03x | 4 | 29807.3 | 43625.9 | 42.36% | 32->4 | PASS |
| windows-aarch64 | 1.705 | 1.703 | 1.00x | 4 | 76405.9 | 83460.3 | 8.24% | 32->4 | PASS |
| windows-x86_64 | 1.287 | 1.296 | 1.00x | 16 | 72716.3 | 79675.6 | 12.19% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
