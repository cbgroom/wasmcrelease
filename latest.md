# WAsmC Host HTTPS paired A/B flywheel

Commit: bb119566b100d49611d4a199fc9595e5aabba526  
Measured: 2026-09-29T04:30:56.369Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.776 | 1.822 | 1.01x | 16 | 311410.1 | 359058.2 | 15.30% | 32->16 | PASS |
| linux-x86_64 | 1.351 | 1.347 | 1.00x | 16 | 114401.8 | 133979.8 | 17.30% | 32->16 | PASS |
| macos-aarch64 | 18.509 | 1333.934 | 83.08x | 8 | 114366.5 | 114771.6 | 10.34% | 32->8 | PASS |
| macos-x86_64 | 0.603 | 0.764 | 1.06x | 16 | 23979.2 | 34754.7 | 34.45% | 32->16 | PASS |
| windows-aarch64 | 1.718 | 1.722 | 1.01x | 4 | 78266.8 | 86092.4 | 10.88% | 32->4 | PASS |
| windows-x86_64 | 1.257 | 1.247 | 1.00x | 8 | 69570.1 | 79224.3 | 12.99% | 32->8 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
