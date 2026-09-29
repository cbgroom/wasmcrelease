# WAsmC Host HTTPS paired A/B flywheel

Commit: 682fe7e27b8b63d9d1f651b7ad21dfb6cd7bf533  
Measured: 2026-09-29T13:06:44.865Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.797 | 1.823 | 1.01x | 8 | 321028.1 | 364397.5 | 16.82% | 32->8 | PASS |
| linux-x86_64 | 1.369 | 1.367 | 1.00x | 2 | 128903.9 | 142939.2 | 10.14% | 32->2 | PASS |
| macos-aarch64 | 1.826 | 1.839 | 1.00x | 2 | 92854.3 | 98883.5 | 13.36% | 32->2 | PASS |
| macos-x86_64 | 0.939 | 1.013 | 1.01x | 8 | 39315.4 | 54709.6 | 34.38% | 32->8 | PASS |
| windows-aarch64 | 1.730 | 1.738 | 1.00x | 4 | 82203.1 | 88501.7 | 7.54% | 32->4 | PASS |
| windows-x86_64 | 1.540 | 1.553 | 0.99x | 16 | 86036.7 | 99007.5 | 14.43% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
