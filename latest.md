# WAsmC Host HTTPS paired A/B flywheel

Commit: 1648d18192a1bf2c9fcc317fd8b82075c5eabfcf  
Measured: 2026-09-20T17:07:40.880Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.812 | 1.822 | 1.01x | 16 | 334586.7 | 374732.3 | 9.30% | 32->16 | PASS |
| linux-x86_64 | 1.699 | 1.709 | 1.00x | 2 | 172974.6 | 199321.1 | 17.79% | 32->2 | PASS |
| macos-aarch64 | 1.722 | 1.952 | 1.19x | 4 | 82247.0 | 82162.8 | -0.10% | 32->4 | PASS |
| macos-x86_64 | 0.839 | 0.826 | 0.95x | 8 | 29477.0 | 42666.9 | 44.75% | 32->8 | PASS |
| windows-aarch64 | 1.735 | 1.742 | 1.00x | 8 | 79750.0 | 88334.1 | 11.14% | 32->8 | PASS |
| windows-x86_64 | 1.527 | 1.539 | 0.98x | 16 | 108954.7 | 129140.3 | 16.48% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
