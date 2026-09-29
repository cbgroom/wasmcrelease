# WAsmC Host HTTPS paired A/B flywheel

Commit: e84f55f38146298842c27238e1338f236d3f2bde  
Measured: 2026-09-29T12:23:39.211Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.778 | 1.799 | 1.01x | 16 | 316998.9 | 332935.5 | 9.22% | 32->16 | PASS |
| linux-x86_64 | 1.356 | 1.323 | 0.98x | 8 | 117360.9 | 129184.3 | 10.71% | 32->8 | PASS |
| macos-aarch64 | 1.880 | 605.156 | 180.07x | 2 | 88365.6 | 80574.6 | -8.82% | 32->2 | PASS |
| macos-x86_64 | 1.206 | 1.191 | 1.00x | 4 | 34232.6 | 48638.2 | 45.53% | 32->4 | PASS |
| windows-aarch64 | 1.667 | 1.669 | 1.00x | 8 | 76924.9 | 82277.2 | 6.96% | 32->8 | PASS |
| windows-x86_64 | 1.171 | 1.187 | 0.99x | 16 | 81462.3 | 92319.7 | 13.65% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
