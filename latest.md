# WAsmC Host HTTPS paired A/B flywheel

Commit: 6334204731334bad44a0a6f540c40f2e9afc081d  
Measured: 2026-09-30T15:08:45.051Z  
Platforms: 6

| Platform | HTTPS polling RPS | HTTPS reactor RPS | HTTPS ratio | c32 best shards | c32 dedicated ops/s | c32 sharded ops/s | c32 delta | c32 threads | Semantic parity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| linux-aarch64 | 1.783 | 1.776 | 0.99x | 8 | 301321.8 | 323426.0 | 3.90% | 32->8 | PASS |
| linux-x86_64 | 1.349 | 1.311 | 0.97x | 2 | 125786.6 | 145412.2 | 15.99% | 32->2 | PASS |
| macos-aarch64 | 39.284 | 1881.656 | 39.08x | 1 | 109722.6 | 127555.9 | 21.05% | 32->1 | PASS |
| macos-x86_64 | 1.096 | 1.095 | 0.99x | 8 | 36695.0 | 42852.2 | 21.73% | 32->8 | PASS |
| windows-aarch64 | 1.729 | 1.737 | 1.00x | 4 | 81716.7 | 87477.5 | 6.96% | 32->4 | PASS |
| windows-x86_64 | 1.253 | 1.268 | 1.01x | 16 | 72334.8 | 79793.8 | 12.13% | 32->16 | PASS |

HTTPS polling-vs-reactor remains a semantic/full-stack mechanism canary. The c32 transport lane sweeps 1/2/4/8/16 shared-reactor shards against event-driven dedicated mio owners and reports the best observed hosted point per platform. Neither lane is a product SLA or a production-default selector.
