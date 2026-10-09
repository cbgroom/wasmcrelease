# WAsmC Host HTTPS paired A/B flywheel

Commit: c888af39c11640644591ff42aeaf8b09f632f651  
Measured: 2026-10-09T00:11:27.965Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.796 | 1.801 | 1.00x | 8 | 298039.6 | 358638.5 | 15.36% | 32->8 | PASS |
| linux-x86_64 | 2486.656 | 2635.674 | 1.04x | 16 | 201497.7 | 218921.3 | 8.65% | 32->16 | PASS |
| macos-aarch64 | 1.710 | 1.784 | 1.02x | 1 | 78549.0 | 64224.5 | -7.27% | 32->1 | PASS |
| macos-x86_64 | 1.208 | 1.256 | 1.03x | 4 | 35913.3 | 42260.7 | 30.85% | 32->4 | PASS |
| windows-aarch64 | 1.736 | 1.758 | 1.01x | 16 | 71334.9 | 83035.0 | 16.40% | 32->16 | PASS |
| windows-x86_64 | 1.232 | 1.242 | 1.00x | 16 | 69976.3 | 76982.5 | 10.01% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
