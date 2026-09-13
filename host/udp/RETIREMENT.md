# UDP send and retirement ownership

The mutable prebound/fixed-peer endpoint owns a captured send snapshot until
its send callback settles. While sending, read/release/terminateRead reject
busy without closing the socket. `terminateRead` applies only to pending reads
or an idle endpoint, never to an issued write. Local send completion is not
peer delivery; failure may have an external effect and is never replayed.

Ordinary release waits actual close acknowledgement. A failed close retains
the endpoint in stopped state, denies business I/O and allows only explicit
retirement to retry close. A delayed close keeps release busy until ack.

```
node host/udp/retirement-test.mjs
bun host/udp/retirement-test.mjs
deno run host/udp/retirement-test.mjs
```

Twelve controlled-backend cases cover pending successful/failed sends, owned
snapshot mutation, busy denials, no premature close, failed-close retry and
delayed acknowledgement. The original implementation reproduced premature
close before this fix. These tests are not OS fault injection, Native async
qualification, UDP reliability or full Std/no-JIT qualification. Actual
datagram/App/Lib tests and eleven real-loopback/controlled fault cases remain
mandatory alongside them. No new Host import or producer rebuild is introduced.
