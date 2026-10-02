# WAsmC Host HTTPS paired A/B flywheel

Commit: dd30f28276a633cefb68972186c2cbeb2fca4a80  
Measured: 2026-10-02T09:38:58.171Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.791 | 1.796 | 1.00x | 8 | 313568.8 | 368797.2 | 9.65% | 32->8 | PASS |
| linux-x86_64 | 1.353 | 1.339 | 1.00x | 16 | 128139.7 | 141665.0 | 10.55% | 32->16 | PASS |
| macos-aarch64 | 1.855 | 1.922 | 1.08x | 2 | 92033.2 | 95276.6 | 52.74% | 32->2 | PASS |
| macos-x86_64 | 0.804 | 0.930 | 1.04x | 8 | 30828.6 | 36193.8 | 17.40% | 32->8 | PASS |
| windows-aarch64 | 1.713 | 1.716 | 1.00x | 8 | 66967.5 | 80089.3 | 19.92% | 32->8 | PASS |
| windows-x86_64 | 1.151 | 1.212 | 1.00x | 8 | 69466.6 | 78202.6 | 10.95% | 32->8 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
