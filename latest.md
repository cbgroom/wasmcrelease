# WAsmC Host HTTPS paired A/B flywheel

Commit: 4ca6374da5521d25b3c1c0449d1c6dfb9cffe811  
Measured: 2026-09-30T16:11:58.039Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.777 | 1.788 | 1.00x | 8 | 312789.6 | 348436.6 | 9.77% | 32->8 | PASS |
| linux-x86_64 | 74.990 | 1.823 | 0.97x | 8 | 302503.9 | 348708.0 | 22.11% | 32->8 | PASS |
| macos-aarch64 | 1.870 | 1.884 | 1.01x | 2 | 85432.3 | 90642.4 | -4.19% | 32->2 | PASS |
| macos-x86_64 | 1.030 | 0.952 | 0.93x | 8 | 34087.2 | 46425.5 | 35.54% | 32->8 | PASS |
| windows-aarch64 | 1.696 | 1.673 | 1.00x | 8 | 71717.9 | 80154.7 | 11.76% | 32->8 | PASS |
| windows-x86_64 | 1.344 | 1.344 | 1.00x | 16 | 80606.6 | 88028.6 | 10.59% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
