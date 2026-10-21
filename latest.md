# WAsmC Host HTTPS paired A/B flywheel

Commit: b198337762a977b81d6f4a3e1e05290f60899c74  
Measured: 2026-10-21T19:05:38.353Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.801 | 1.791 | 0.99x | 16 | 293207.1 | 362952.4 | 23.92% | 32->16 | PASS |
| linux-x86_64 | 1.336 | 1.318 | 1.00x | 8 | 120514.1 | 126367.3 | 9.51% | 32->8 | PASS |
| macos-aarch64 | 45.663 | 3052.591 | 65.56x | 2 | 150115.1 | 140673.5 | 4.40% | 32->2 | PASS |
| macos-x86_64 | 0.935 | 0.948 | 1.00x | 4 | 25115.4 | 36449.0 | 63.02% | 32->4 | PASS |
| windows-aarch64 | 1.661 | 1.664 | 1.00x | 4 | 76757.0 | 85070.1 | 11.03% | 32->4 | PASS |
| windows-x86_64 | 1.298 | 1.300 | 1.01x | 4 | 75458.5 | 75017.3 | 2.61% | 32->4 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
