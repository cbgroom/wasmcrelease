# TCP finish-write profile and remaining Bun gap

`finish-write` is a finite stream control under the existing `invoke` family.
It is not endpoint retirement, remote delivery, TLS shutdown or a new Host
primitive. A successful local flush/FIN acknowledgement must leave read
ownership alive. Repeated finish and subsequent writes reject; actual resource
retirement still waits for socket close.

Local 2026-09-13 results:

| Exact runtime/profile | Actual FIN then receive | Current contract |
| --- | --- | --- |
| Node26.5.1 Node-compatible TCP | PASS | supported candidate |
| Deno2.9.4 Node-compatible TCP | PASS | supported candidate |
| Bun1.3.14 Node-compatible TCP | FAIL, read returned EOF instead of peer byte | unsupported, rejected before FIN |

The failing Bun receive-after-FIN oracle also used the independent pure-Rust
peer, not only a same-runtime client. The older read-request-to-EOF then reply
journey passes but does **not** establish the reverse half-close ordering.
Do not infer that every Bun transport is incapable: exploratory native Bun
`end(data)`/`shutdown(true)` probes were inconclusive timeouts, not an admitted
adapter. The [official native socket contract](https://bun.com/reference/bun/Socket)
describes write-half shutdown; a proper native backend still needs bounded
buffering, readiness, flush acknowledgement and actual independent oracles.

The current Node-compatible adapter conservatively rejects finish-write under
Bun, including unqualified newer versions. Do not remove that rejection merely
because a method exists or documentation promises half-close. Qualify a real
backend/engine profile first. This is a remaining full Host delivery gap, not a
completed Bun half-close implementation.

## Reproduce admitted candidate behavior

```sh
node host/session/finish-write-test.mjs
deno run --allow-net=127.0.0.1 host/session/finish-write-test.mjs
bun host/session/finish-write-test.mjs --expect-unsupported
```

Node/Deno receipts require the peer to observe FIN and then send a byte which
the same endpoint reads. They also require repeated finish/write rejection and
zero retained resources. Bun requires unsupported **before effect**, then
ordinary peer-to-service transfer still succeeds; its receipt has
`accepted=false, negative_contract_pass=true`. A successful negative contract
check never counts as positive feature execution.

Optional independent peer (no Cargo):

```sh
rustc --edition=2024 -C opt-level=s -C strip=symbols -D warnings host/session/network-peer.rs -o target/nonblocking-read/network-peer
node host/session/finish-write-test.mjs target/nonblocking-read/network-peer
```

The retained regular network App has its established five stages. It does not
request finish-write or claim half-close maturity. A six-stage experimental App
initially passed ordinary reply journeys but exposed the missing reverse-order
oracle; it was not promoted as a cross-platform consumer. The dedicated FIN
oracle now independently guards this profile.

Actions adds nine source-bound FIN receipts (three runtimes/three OSes), with
explicit non-positive Bun evidence. New-source cross-platform qualification is
pending until the exact run and receipts are reviewed. No typed Core SDK,
Native same-contract implementation or full Host acceptance is claimed.
