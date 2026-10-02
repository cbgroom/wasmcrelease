# WAsmC Host HTTPS paired A/B flywheel

Commit: 5e7cc8403a8e1f707211dd31f799f08511368fab  
Measured: 2026-10-02T07:38:53.020Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.810 | 1.804 | 1.00x | 8 | 289206.5 | 321662.0 | 15.37% | 32->8 | PASS |
| linux-x86_64 | 1.350 | 1.312 | 0.98x | 4 | 117711.5 | 128447.9 | 8.42% | 32->4 | PASS |
| macos-aarch64 | 1.630 | 1.741 | 1.02x | 2 | 104954.1 | 104293.5 | 8.54% | 32->2 | PASS |
| macos-x86_64 | 1.254 | 1.206 | 0.99x | 4 | 35660.0 | 49079.4 | 27.99% | 32->4 | PASS |
| windows-aarch64 | 1.718 | 1.730 | 1.01x | 4 | 64755.0 | 66191.4 | 20.96% | 32->4 | PASS |
| windows-x86_64 | 1.234 | 1.240 | 1.00x | 16 | 70980.5 | 79572.2 | 13.51% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
