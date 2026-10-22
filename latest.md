# WAsmC Host HTTPS paired A/B flywheel

Commit: 56dafbde62935006b65a2ba807d833d7b1cdff57  
Measured: 2026-10-22T22:26:22.790Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.780 | 1.785 | 0.99x | 4 | 342382.0 | 376223.2 | 9.88% | 32->4 | PASS |
| linux-x86_64 | 1.332 | 1.363 | 1.00x | 16 | 126459.8 | 139338.4 | 10.18% | 32->16 | PASS |
| macos-aarch64 | 1.781 | 1.838 | 0.92x | 16 | 123633.1 | 94508.5 | 6.24% | 32->16 | PASS |
| macos-x86_64 | 0.765 | 0.768 | 1.01x | 4 | 16361.6 | 32567.3 | 59.13% | 32->4 | PASS |
| windows-aarch64 | 1.719 | 1.706 | 0.99x | 8 | 75282.9 | 83660.7 | 10.80% | 32->8 | PASS |
| windows-x86_64 | 1337.448 | 1286.320 | 1.08x | 16 | 147079.3 | 191830.3 | 28.55% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
