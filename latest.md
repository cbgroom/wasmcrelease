# WAsmC Host HTTPS paired A/B flywheel

Commit: 7e66609ce71a62e82328fa4ed313cf21efd2c742  
Measured: 2026-10-02T19:56:00.702Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.791 | 1.795 | 0.99x | 8 | 330093.2 | 339839.0 | 13.63% | 32->8 | PASS |
| linux-x86_64 | 1.366 | 1.344 | 0.98x | 16 | 127653.2 | 142528.2 | 11.65% | 32->16 | PASS |
| macos-aarch64 | 1.630 | 1.699 | 0.98x | 16 | 104748.7 | 103668.2 | -1.03% | 32->16 | PASS |
| macos-x86_64 | 0.866 | 0.952 | 1.16x | 16 | 29695.5 | 35431.2 | 13.56% | 32->16 | PASS |
| windows-aarch64 | 1.686 | 1.711 | 1.01x | 4 | 78107.2 | 84611.1 | 7.60% | 32->4 | PASS |
| windows-x86_64 | 316.692 | 355.895 | 1.22x | 16 | 160076.1 | 206004.9 | 29.00% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
