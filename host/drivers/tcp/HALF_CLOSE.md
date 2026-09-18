# TCP half-close interoperability

Host listener inherits the explicitly trusted server `allowHalfOpen` policy on
accepted sockets before readable EOF. It does not force that policy on every
preconnected socket or grant new guest authority. No Host/Core import is added.

Local macOS ARM Bun1.3.14 accepted sockets incorrectly reported false despite
`createServer({allowHalfOpen:true})`; its tagged public source constructs the
accepted Node socket with empty options. This caused reply-after-read-EOF to
fail. Applying the trusted server property fixes that server-side error using
the documented mutable Duplex property, not runtime-private socket handles.

References: [Bun Socket.allowHalfOpen](https://bun.com/reference/node/net/Socket/allowHalfOpen)
and [Bun1.3.14 net source](https://github.com/oven-sh/bun/blob/bun-v1.3.14/src/js/node/net.ts).

## Independent peer proof and remaining limitation

`node host/drivers/tcp/half-close-test.mjs <tcp-half-close-peer>` runs a trusted Rust
loopback peer: write three bytes, shutdown only Write, then read response/EOF.
The JS Host must read input and EOF, send24, retire and the Native peer must
actually receive24. Node/Bun/restricted Deno locally pass this after policy
inheritance. This is real peer evidence, not just successful write callback.
The Rust peer has bounded read/write timeouts and no guest address/DNS authority.

Without the binary, the same test uses its runtime's Node-compatible JS client.
Node/Deno locally pass. Bun1.3.14 macOS ARM still loses the reply after its client
calls end, even though the independent Rust peer receives it from the same
Bun Host adapter. This distinguishes residual client/runtime behavior from
the fixed server policy. Do not advertise full Bun client half-close parity.

`bun host/drivers/tcp/half-close-test.mjs --characterize-js-peer` records this residual
behavior: missing reply yields `accepted=false`, `profile_supported=false` but
`probe_completed=true`. It is an explicit compatibility characterization, not
a positive qualification or production capability. Other corruption/errors
still fail. CI requires the Native-peer positive result; Bun JS-peer results
remain separate, platform-bound evidence and must not close the full parity gate.
Plain mode remains strict and fails on lost data. No retries, reconnect, sleeps
or fabricated acknowledgements repair business I/O. Existing framed server
fixtures are not rewritten as if they proved this behavior.
