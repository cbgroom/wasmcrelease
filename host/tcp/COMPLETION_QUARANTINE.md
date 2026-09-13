# Rejected completion retains its owner

Trusted Host-driver mechanics; no new guest import/semantic API or business I/O
retry. Invalid settled bytes must not escape as ordinary failure while pinned
guard records become unreachable. `TcpCompletionFailure` is a supervisor-owned
subtype of `TcpStopFailure`, with primary bounds(-5) and the original completion
rejection cause. It revokes new grants, retains endpoint/window/operation and
suppresses bytes. Correction/new I/O is denied; quota includes quarantine.

Explicit supervisor retirement proves endpoint termination and close before
draining the rejected completion with an empty failed result and recycling.
Failed stop/close retains the quarantine; a cancelled record alone is not backend
termination. A backend read has already settled here, but this does not prove
all endpoint effects or close acknowledgement. There is no second read/write.

```sh
node host/tcp/completion-quarantine-test.mjs --real-tcp
bun host/tcp/completion-quarantine-test.mjs --real-tcp
deno run --allow-net=127.0.0.1 host/tcp/completion-quarantine-test.mjs --real-tcp
```

Six controlled malformed completions (oversized, sparse, out-of-u8, negative,
fractional, null) verify retained[1,1] pins, denied correction/quota, failed stop,
then explicit acknowledged retirement to[0,0] without I/O replay. One actual TCP
read is deliberately corrupted by trusted harness glue after receiving7; the
first termination seam fails, the second genuinely closes both peers. Zero
reply bytes and one read are independently observed. This is not an OS-generated
malformed buffer, Native async/thread race, generic guard-release fault recovery
or completed typed SDK. Native's separate settled-completion quarantine policy
remains tested by its owner-unit cases; it does not imply this JS async proof.
