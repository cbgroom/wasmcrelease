# WAsmC Host HTTPS paired A/B flywheel

Commit: f5e7e14864de1a480b351872721ac6dc840215fc  
Measured: 2026-10-02T18:50:32.482Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.781 | 1.780 | 1.00x | 16 | 331029.0 | 362607.8 | 9.54% | 32->16 | PASS |
| linux-x86_64 | 3536.212 | 3608.429 | 1.00x | 2 | 211367.1 | 243808.7 | 16.50% | 32->2 | PASS |
| macos-aarch64 | 1.863 | 1.804 | 1.07x | 4 | 107562.0 | 86774.0 | -1.34% | 32->4 | PASS |
| macos-x86_64 | 0.846 | 0.983 | 0.99x | 8 | 28255.4 | 39908.9 | 35.48% | 32->8 | PASS |
| windows-aarch64 | 1.736 | 1.731 | 1.00x | 8 | 82679.6 | 91013.8 | 10.08% | 32->8 | PASS |
| windows-x86_64 | 1.270 | 1.233 | 0.96x | 4 | 53324.4 | 57107.9 | 7.02% | 32->4 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
