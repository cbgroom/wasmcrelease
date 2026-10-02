# WAsmC Host HTTPS paired A/B flywheel

Commit: d131f57b5e473e466f59cec3570aefe218e68167  
Measured: 2026-10-02T08:04:42.939Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.799 | 1.804 | 1.00x | 8 | 342386.6 | 360464.6 | 8.03% | 32->8 | PASS |
| linux-x86_64 | 1.338 | 1.366 | 1.01x | 2 | 127802.6 | 144832.0 | 14.32% | 32->2 | PASS |
| macos-aarch64 | 16.944 | 1460.325 | 65.31x | 4 | 117659.4 | 127132.4 | 18.42% | 32->4 | PASS |
| macos-x86_64 | 1.177 | 1.232 | 1.02x | 8 | 40901.4 | 56010.0 | 36.94% | 32->8 | PASS |
| windows-aarch64 | 1.738 | 1.740 | 0.99x | 4 | 82493.6 | 90119.2 | 9.82% | 32->4 | PASS |
| windows-x86_64 | 1.924 | 1.935 | 0.98x | 16 | 157926.9 | 202381.8 | 30.71% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
