# WAsmC Host HTTPS paired A/B flywheel

Commit: e6d50dece1ec0723ced1291ec6d98c6705314876  
Measured: 2026-09-27T05:12:39.128Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.793 | 1.812 | 1.01x | 8 | 305798.3 | 327956.3 | 7.25% | 32->8 | PASS |
| linux-x86_64 | 1.698 | 1.700 | 1.00x | 8 | 168699.9 | 186992.0 | 10.27% | 32->8 | PASS |
| macos-aarch64 | 28.692 | 2856.105 | 100.48x | 2 | 137763.1 | 165266.7 | 19.96% | 32->2 | PASS |
| macos-x86_64 | 1.295 | 1.196 | 0.93x | 8 | 28545.1 | 53741.1 | 61.58% | 32->8 | PASS |
| windows-aarch64 | 1.765 | 1.762 | 1.00x | 4 | 81568.2 | 90206.5 | 9.96% | 32->4 | PASS |
| windows-x86_64 | 1.783 | 1.795 | 1.00x | 16 | 93379.0 | 102605.3 | 9.18% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
