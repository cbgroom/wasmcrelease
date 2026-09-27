# iOS deferred-work provider

This package maps `wasmc:system-deferred-work@0.0.1` scheduling semantics to
BGTaskScheduler without extending the fixed Host. The exact Simulator accepts
handler registration but rejects refresh-request submission with
`BGTaskSchedulerErrorDomain Code=1`; therefore this candidate remains
unqualified and the submit/inspect/cancel lifecycle is a physical-device gate.

System delivery is intentionally a separate gate. A request accepted into the
pending queue is not proof that iOS launched the handler, honored the earliest
date, provided execution time, invoked expiration, or relaunched a terminated
App. No private debugger simulation API is used to manufacture that evidence.
