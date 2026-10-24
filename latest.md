# WAsmC Host HTTPS paired A/B flywheel

Commit: 503dd4ed22e3704b1dd9dce0b6923c73d6702344  
Measured: 2026-10-24T18:17:27.875Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.779 | 1.797 | 1.00x | 16 | 320881.1 | 373456.3 | 14.28% | 32->16 | PASS |
| linux-x86_64 | 1.366 | 1.334 | 1.00x | 16 | 127394.4 | 137425.7 | 8.80% | 32->16 | PASS |
| macos-aarch64 | 1.706 | 1.789 | 0.96x | 1 | 88436.8 | 83187.1 | 8.38% | 32->1 | PASS |
| macos-x86_64 | 0.848 | 0.853 | 0.91x | 4 | 31722.3 | 42478.7 | 24.84% | 32->4 | PASS |
| windows-aarch64 | 1.691 | 1.711 | 1.01x | 8 | 78260.6 | 89032.9 | 10.58% | 32->8 | PASS |
| windows-x86_64 | 1.277 | 1.277 | 1.00x | 16 | 71042.2 | 78528.6 | 10.66% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
