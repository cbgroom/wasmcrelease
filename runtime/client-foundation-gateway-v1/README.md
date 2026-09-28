# Client Foundation Gateway v1 prototype

This is the persistent control and artifact counterpart to
`runtime/client-foundation-v1`. It is a higher-layer service and does not add a
Host API or change the minimal compiler CLI.

The gateway provides:

- `WSS /v1/clients/<client-id>/control` for one ordered control stream per
  client;
- `POST /v1/artifacts` and content-addressed
  `GET /v1/artifacts/<sha256>` for exact Client Foundation bundles;
- `POST /v1/clients/<client-id>/commands` for idempotent command enqueue by
  `message_id`;
- `GET /v1/clients/<client-id>` for durable hello, command and receipt state;
- atomic JSON state plus content-addressed artifact files that survive gateway
  restart;
- an exclusive data-root writer lock with stale-owner recovery;
- WSS ping/pong liveness and stale-connection eviction;
- bounded hot command state with immutable, SHA-256-bound JSONL archive
  segments; only active commands remain in the hot message index, while an
  exact archive lookup preserves old enqueue idempotency;
- fail-closed startup verification of every artifact and archive identity,
  byte count, path and command sequence watermark.

The gateway persists a command before delivery and persists its receipt before
dispatching the next sequence. If the gateway loses a receipt after the client
has committed it, reconnect redelivers the same message identity and sequence;
the client returns its durable receipt. A second enqueue with the same identity
and different content is rejected.

Start the standalone service with explicit TLS and state paths:

```sh
WASMC_GATEWAY_DATA_ROOT=/var/lib/wasmc-gateway \
WASMC_GATEWAY_TLS_KEY=/run/secrets/tls.key \
WASMC_GATEWAY_TLS_CERT=/run/secrets/tls.crt \
WASMC_GATEWAY_PORT=8443 \
node runtime/client-foundation-gateway-v1/cli.mjs
```

`WASMC_GATEWAY_MAX_COMPLETED_COMMANDS`,
`WASMC_GATEWAY_HEARTBEAT_INTERVAL_MS`, and
`WASMC_GATEWAY_HEARTBEAT_TIMEOUT_MS` tune hot-state compaction and liveness.
The timeout should be larger than the heartbeat interval.

Run the local restart qualification:

```sh
node scripts/test-client-foundation-gateway-v1.mjs
```

This prototype intentionally contains no user/account authorization layer. It
is a single-writer service: the lock prevents corruption but is not a clustered
consensus protocol. Archive deletion/retention policy, archive metadata
compaction, indexed lookup acceleration, fleet scheduling, public deployment
and external load qualification remain deployment-layer work. The current
evidence is one local Node process with an exact repository-local TLS fixture,
not admission or release.
