# Bounded idle guard reuse

Only the mutable JS Host supervisor uses this private optimization. Agent/Core
APIs and all frozen products are unchanged; Native guard pooling is not claimed.
One completed call may return its guard to a pool only after verified endpoint
retirement and zero operation/window records. Revoked, exhausted, active or
quarantined guards never enter the pool, including unknown retirement with zero
diagnostic records. The pool is bounded by the supervisor owner limit.

The same binding identity/local counter continue monotonically; neither resets
when reused. A new operation needs two fresh local IDs. Once exhausted, discard
the empty binding and create a fresh CSPRNG scope. Pending ownership never moves
between bindings and old tickets remain invalid. Supervisor ticket rotation and
live-quarantine fences are unchanged. Ordinary revoked quarantine retirement
does not cache its guard. Internal unknown release still requires isolation.

```
node host/drivers/tcp/guard-pool-test.mjs
node host/drivers/tcp/owner-benchmark.mjs
```

Five controls pass Node/Bun/restricted Deno:40000 unique operation tickets across
three scopes, concurrent close-ack admission, stale ticket rejection during
reuse, revoked/known-quarantine exclusion and zero-record unknown-quarantine
exclusion. Existing40000 scoped/supervisor cycles, twelve internal guard faults,
six malformed completion controls, fourteen supervisor controls and real TCP
driver cancellation/retirement/server regressions remain mandatory.

Local macOS arm64, Node26.5.1/Bun1.3.14/Deno2.9.4, same controlled50000-call
bookkeeping workload before/after (five batches of10000, checksum350000):

| Engine | Before ns/call | Reuse ns/call |
| --- | ---: | ---: |
| Node | 5551 | 2325 |
| Bun | 3484 | 1738 |
| Deno | 6200 | 3029 |

Fresh guard construction drops50000->4; each call still verifies one read and
one acknowledged retirement. Baseline runtime source resolves from the parent
mobile-dependency-gate checkpoint; candidate code is the containing Git commit.
Local measurements used a modified candidate and benchmark instrumentation,
not a clean immutable release. Values are observations, not speed guarantees,
network/TLS/database/durable TPS, RSS proof or Native pooling qualification.
Actions should check correctness counts, never enforce runner speed thresholds.
