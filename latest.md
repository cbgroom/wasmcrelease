# WAsmC Host HTTPS paired A/B flywheel

Commit: 88064c74b1d651dab5758b9f6c750df1a107de15  
Measured: 2026-09-30T15:25:50.589Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.816 | 1.788 | 1.00x | 8 | 313173.3 | 348268.2 | 21.45% | 32->8 | PASS |
| linux-x86_64 | 1.338 | 1.337 | 1.00x | 16 | 130601.8 | 141973.4 | 8.35% | 32->16 | PASS |
| macos-aarch64 | 1.882 | 1.871 | 1.02x | 16 | 88569.1 | 96883.9 | 0.45% | 32->16 | PASS |
| macos-x86_64 | 1.390 | 1.371 | 0.99x | 8 | 45010.8 | 56287.9 | 25.05% | 32->8 | PASS |
| windows-aarch64 | 1.754 | 1.754 | 1.00x | 4 | 58376.4 | 49217.5 | 9.64% | 32->4 | PASS |
| windows-x86_64 | 1.270 | 1.265 | 1.00x | 16 | 69961.4 | 77181.1 | 11.77% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
