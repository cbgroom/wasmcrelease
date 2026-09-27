# WAsmC Host HTTPS paired A/B flywheel

Commit: 41fe6073f524d8e8aa7bc0f0d2b6df4592187236  
Measured: 2026-09-27T04:01:30.436Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.800 | 31.171 | 17.32x | 16 | 322462.7 | 359013.8 | 11.06% | 32->16 | PASS |
| linux-x86_64 | 1.376 | 1.341 | 0.97x | 16 | 122614.9 | 140046.2 | 10.86% | 32->16 | PASS |
| macos-aarch64 | 39.451 | 2360.194 | 52.89x | 8 | 138583.4 | 135449.4 | 3.34% | 32->8 | PASS |
| macos-x86_64 | 0.565 | 0.565 | 0.90x | 8 | 21649.0 | 26699.5 | 32.49% | 32->8 | PASS |
| windows-aarch64 | 1.732 | 1.733 | 1.00x | 4 | 77540.9 | 86530.8 | 8.75% | 32->4 | PASS |
| windows-x86_64 | 1.418 | 1.388 | 0.98x | 16 | 73759.3 | 82758.8 | 17.73% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
