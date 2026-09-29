# WAsmC Host HTTPS paired A/B flywheel

Commit: 0489215f024a75c70adb8bd961c26f31ddb3a0a3  
Measured: 2026-09-29T03:33:57.962Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.767 | 1.780 | 1.01x | 16 | 305221.5 | 354191.7 | 8.32% | 32->16 | PASS |
| linux-x86_64 | 1.708 | 1.700 | 0.99x | 2 | 170032.8 | 185768.2 | 9.25% | 32->2 | PASS |
| macos-aarch64 | 1.824 | 1.942 | 1.06x | 16 | 86960.6 | 109250.8 | 52.32% | 32->16 | PASS |
| macos-x86_64 | 0.768 | 0.887 | 1.00x | 8 | 19230.1 | 32370.2 | 93.99% | 32->8 | PASS |
| windows-aarch64 | 1.715 | 1.715 | 1.00x | 4 | 78253.3 | 85634.8 | 9.43% | 32->4 | PASS |
| windows-x86_64 | 1.253 | 1.289 | 1.02x | 8 | 55387.9 | 60753.1 | 9.69% | 32->8 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
