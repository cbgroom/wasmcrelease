# WAsmC Host HTTPS paired A/B flywheel

Commit: 137022b0e66b2c22bb809850ca5d0c69d2a5f89a  
Measured: 2026-10-02T19:28:26.183Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.814 | 1.821 | 1.00x | 16 | 341248.0 | 355835.5 | 4.28% | 32->16 | PASS |
| linux-x86_64 | 2522.965 | 2476.684 | 1.02x | 2 | 197745.6 | 226249.4 | 14.30% | 32->2 | PASS |
| macos-aarch64 | 30.913 | 798.218 | 20.95x | 4 | 94361.9 | 96529.2 | 2.30% | 32->4 | PASS |
| macos-x86_64 | 0.598 | 0.653 | 0.95x | 4 | 22043.2 | 29003.0 | 34.42% | 32->4 | PASS |
| windows-aarch64 | 1.704 | 1.699 | 0.99x | 16 | 70125.9 | 78662.3 | 12.17% | 32->16 | PASS |
| windows-x86_64 | 1.188 | 1.212 | 1.02x | 16 | 74521.0 | 83754.4 | 11.32% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
