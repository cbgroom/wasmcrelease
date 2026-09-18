# Ordinary driver retirement quarantine

The read/write helpers now close the settled endpoint **before** retiring
operation/window records. Ordinary endpoint close failure throws the existing
Host-private `TcpStopFailure` owner carrier and revokes the guard. Supervisor
admission retains that owner and counts it against active+quarantine quota.
Neither successful read bytes nor an ordinary success response is published
after failed retirement. The read failure carrier contains only a suppression
summary, not otherwise-deliverable bytes.

Primary failures remain available in `failure.primary`; close failure is
`failure.cause`. Write outcomes retain actual acknowledgement and effect
semantics: `accepted_locally` is not peer receipt/durability, and failed write
can be `possibly_partial` with unknown acknowledgement. No rollback/replay is
introduced. Ordinary write close failure previously returned `cleanup_error`
without registry retention; this mutable reference now throws a quarantined
owner instead. This is not an immutable product/Core ABI change.

Some ordinary completions are already drained before close fails. Explicit
supervisor retirement checks `poll(...).drained`, completes only undrained
records, then releases them. It must not complete an already-drained record a
second time. Stop/endpoint retirement must acknowledge first; failures retain
the owner for another explicit retirement attempt. Guard-release fault recovery
and generic backends remain outside this narrow change.

```sh
node host/drivers/tcp/driver-retirement-test.mjs
bun host/drivers/tcp/driver-retirement-test.mjs
deno run host/drivers/tcp/driver-retirement-test.mjs
node host/drivers/tcp/driver-retirement-test.mjs --real-tcp
bun host/drivers/tcp/driver-retirement-test.mjs --real-tcp
deno run --allow-net=127.0.0.1 host/drivers/tcp/driver-retirement-test.mjs --real-tcp
```

Four controlled cases cover successful read, invalid preissue policy, successful
write and failed write; each has a subsequent failed close. Exact oracles check
primary/cause, quota, record state, close attempts and zero business replay.
The real loopback case injects the first release failure, retains a settled
read record, then explicitly destroys/closes the actual socket and observes
peer close. One read, two release attempts, zero retained resources after ack.
It does not induce an OS destroy failure or qualify Native failed-close races.

Existing real read-stop/write-outcome/resident App/Lib, failed-stop supervisor,
40000-cycle lifetime, and endpoint retirement controls remain required. Local
proof is distinct from exact cross-platform acceptance/main integration. No
formal release, generic typed async SDK or whole-platform fault proof is claimed.
