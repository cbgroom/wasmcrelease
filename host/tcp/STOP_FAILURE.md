# Failed close acknowledgement

Read/write drivers attach rejection handling at stop issuance, including
synchronous backend throws. They still wait for already-issued I/O settlement.
If close acknowledgement fails, they throw Host-only `TcpStopFailure`, revoke
the guard and **do not** complete/drain/free its pending operation/window or
release/recycle the endpoint. Cancelled write effects remain possibly partial;
the exception retains the primary outcome and close cause separately.

The trusted supervisor owns `failure.owner` (endpoint, guard and resource
tickets). It must retain quarantine until verified backend termination/whole
owner teardown, bound quarantined owners and reject new work when its budget
is full. It must not expose this object to the guest, discard ownership as if
cleanup succeeded, force release a pin or replay I/O. There is intentionally
no automatic recovery API that accepts a fabricated acknowledgement. This
policy is for exclusively owned guards/endpoints; sharing their live state
with another request is outside the reviewed reference contract.

This path fails closed, not a promise that any backend can be stopped within a
deadline. A backend whose issued I/O never settles requires supervisor/process
isolation; these drivers cannot hard-preempt it. Native failed-shutdown recovery
and arbitrary concurrent registry races remain unqualified. JS real TCP's
normal successful close still follows its existing acknowledgement/drain path.

```sh
node host/tcp/stop-failure-test.mjs
bun host/tcp/stop-failure-test.mjs
deno run host/tcp/stop-failure-test.mjs
```

Six controls cover read/write asynchronous rejection, synchronous throw while
I/O is pending, and pre-aborted close failure. Checks assert retained pins,
revoked grants/read denial, no endpoint release, no uncaught abort-hook failure
and preserved partial-write status. Actions repeats them on desktop Node and
Unix Bun/Deno. There are no new Core exports or public guest ABI fields.

`driver-error-test.mjs` separately covers ten ordinary failure controls:
invalid signal policies are rejected before I/O without calling foreign
cleanup hooks, and immediate/async read failures both complete/drain normally.
An immediate read throw does not establish a failed close; it is a failed
issued read with no later backend activity, not a reason to strand a pin.
