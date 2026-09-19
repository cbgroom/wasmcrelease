# Public Host + Lib HTTPS qualification

This fixture turns the existing public multi-platform Host qualification into a
full-stack HTTPS system workload.

The workload executes reviewed Core Wasm TLS, HTTP/1, JSON, compression and
routing artifacts through the frozen Host lifecycle shape and real loopback TCP.
It exercises TLS handshake, keep-alive requests, malformed HTTP recovery,
graceful TLS close, exact Host operation/wait/result-claim accounting and
resource retirement.

## Authority and publication boundary

- HTTPS/App/Lib integration source authority:
  `2a49108391326b083426bb5ca12e76b0b9268433`.
- Self-contained Host transport qualification baseline:
  `b1af59699bd27a9d5e3c7d9b6e8951cc1be4302c`.
- Accepted shared-reactor scheduling authority:
  `5dd23b434caa34e402298fcfe0975a1c4af55773`.
- The candidate vendors only Host-runtime readiness/reactor machinery and the
  HTTPS transport adapter needed by this qualification. It does not publish the
  private WAsmC compiler source.
- Binary identities are frozen in `artifact-manifest.json`.
- No private compiler source is required or published.
- The Host transport in this directory is a test/qualification baseline. It is
  not a new Guest ABI and does not create a platform provider binding.

The baseline deliberately predates the readiness/shared-reactor optimization.
The `reactor-candidate` Cargo feature swaps only the Host transport module:
the same HTTPS main, Core Wasm artifacts, request sequence and lifecycle gates
are compiled again against one process-level `mio` shared reactor. This keeps
the A/B boundary narrow enough to attribute the mechanism without changing the
Guest ABI, Lib identities, retry rules or physical socket custody.

## Hard functional gates

The qualification run forces seven-byte physical Host writes and requires:

- 256 keep-alive requests plus one recovery request;
- one malformed request returning 400 without poisoning the next connection;
- graceful TLS close;
- `Host issue == wait == claim`;
- Host write operations equal TLS committed outputs;
- Host byte counts equal TLS ciphertext accounting;
- partial physical writes are actually exercised;
- exactly three TLS resource drops and three Host close acknowledgements;
- no implicit replay or Component-runtime fallback.

Any functional mismatch fails the Action.

## Performance evidence

Performance samples run the same end-to-end executable with a bounded
one-second keep-alive interval. Results include RPS, average request latency,
Host lifecycle counters and sampled per-Lib operation wall/fuel data.

The paired A/B runner alternates execution order across six pairs. It records
the polling baseline and shared-reactor candidate in one report and requires
semantic parity before accepting timing evidence. Polling-owner cycles and
reactor poll/readiness counts are reported separately because they are not the
same event type.

The single-connection HTTPS lane is not used to claim the economic value of
sharing one reactor across many endpoints. A second c32 real-TCP lifecycle
canary compares two event-driven implementations from the same accepted
readiness authority: one dedicated mio owner per connection versus one
process-level shared reactor. Each connection repeatedly performs bounded
Host Window -> Operation -> wait -> take-result write/read echo cycles, and
the gate requires exact issue == wait == claim accounting plus payload
parity. This isolates Host scheduling/thread economics without changing the
HTTPS/Lib functional authority.

The c32 lane reports dedicated-owner thread count, shared-reactor thread count,
Host operations/s and paired throughput deltas. It is a Host scheduling canary,
not an HTTPS or application throughput benchmark. Local CPU/operation evidence
may be used diagnostically, but hosted timing remains observational.

GitHub-hosted timings are **observational**. Functional and artifact-identity
checks are hard gates; timing deltas become engineering evidence for the next
iteration rather than an automatic pass/fail threshold.

The intended flywheel is:

`change -> six-platform HTTPS evidence -> cross-platform/history analysis -> hypothesis -> minimal change -> requalification`.
