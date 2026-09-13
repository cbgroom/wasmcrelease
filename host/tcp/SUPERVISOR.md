# Bounded quarantined-owner supervisor

`TcpOwnerSupervisor` is optional trusted JS Host glue, not a guest/Core ABI,
production global registry or replacement for the frozen Runtime SDK. Its
default four owner slots (configurable 1..16) count **active plus quarantined**
owners. Quota rejection (-3) and duplicate active endpoint rejection (-4) occur
before issuing I/O or transferring endpoint ownership; rejected endpoints stay
with the caller. Guards use private CSPRNG-qualified scopes; idle cleaned guards
may be reused without resetting IDs (see GUARD_POOL.md). Owner tickets are
supervisor-session-qualified and never reused/wrapped past32767.

```js
const supervisor = new TcpOwnerSupervisor(4);
try { const bytes = await supervisor.read(preconnectedEndpoint, {signal}); }
catch (error) {
  if (error instanceof TcpStopFailure) {
    // Supervisor retained ownership; no new I/O on this endpoint.
    // Explicit later termination request, not replay of the read/write:
    await supervisor.retireQuarantine(error.quarantineTicket);
  }
}
```

Retirement accepts only an internally retained ticket. It requests backend
close again and awaits its acknowledgement, then awaits endpoint retirement,
then drains cancelled operation/pin. No caller-provided "closed=true" or
completion data is accepted. A close/retirement rejection retains owner/quota/
pins. Concurrent retirement has one active attempt; foreign/stale tickets are
invalid. Retrying explicit resource close is **not** automatic business I/O
retry/replay. Failed normal driver `release` also enters retained quarantine
(DRIVER_RETIREMENT.md). Unknown internal guard release outcomes retain quota
even with zero records and explicitly reject automatic retirement; isolate
the containing session (GUARD_RETIREMENT.md). Arbitrary guard corruption and
never-settling faults still require deployment-supervisor containment; this reference
does not claim universal backend recovery. Never share an endpoint between
supervisor instances; trusted ownership remains a deployment precondition.

```sh
node host/tcp/supervisor-test.mjs
bun host/tcp/supervisor-test.mjs
deno run host/tcp/supervisor-test.mjs
```

Fourteen controls cover invalid quota, duplicate endpoint, active/quarantine
admission, failed close retaining pins, foreign/stale tickets, concurrent
retirement, close acknowledgement before recycling, retirement failure and
subsequent capacity recovery. Read count never increases during retirement.
Real Chrome/Firefox/WebKit additionally run bounded admission/recovery in
their Node-free probe. Native supervisor equivalence, arbitrary registry races,
hard deadline/never-settling backend isolation and immutable release remain
unclosed. This opt-in supervision is not added to the pure resident compute
microbenchmark or advertised as its latency.
