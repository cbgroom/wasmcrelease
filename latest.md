# WAsmC Host HTTPS paired A/B flywheel

Commit: 94242be1f31afcd71081a59f828c3ff27057fa18  
Measured: 2026-09-27T02:34:55.648Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.814 | 1.813 | 1.00x | 16 | 311022.4 | 353671.2 | 13.71% | 32->16 | PASS |
| linux-x86_64 | 1.351 | 1.363 | 1.01x | 16 | 129419.2 | 140469.1 | 11.95% | 32->16 | PASS |
| macos-aarch64 | 1.862 | 1.886 | 0.97x | 4 | 97236.3 | 88075.8 | -1.47% | 32->4 | PASS |
| macos-x86_64 | 1.170 | 1.189 | 1.04x | 4 | 30619.8 | 37713.2 | 20.84% | 32->4 | PASS |
| windows-aarch64 | 1.735 | 1.727 | 0.99x | 4 | 76714.1 | 87015.7 | 12.97% | 32->4 | PASS |
| windows-x86_64 | 1.284 | 1.297 | 1.01x | 16 | 71154.2 | 80886.9 | 13.28% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
