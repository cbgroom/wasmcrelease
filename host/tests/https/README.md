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
- Binary identities are frozen in `artifact-manifest.json`.
- No private compiler source is required or published.
- The Host transport in this directory is a test/qualification baseline. It is
  not a new Guest ABI and does not create a platform provider binding.

The baseline deliberately predates the private readiness/shared-reactor
optimization. That makes later Host implementations measurable candidates
against the same workload without changing the frozen Host or Lib semantics.

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

GitHub-hosted timings are **observational**. Functional and artifact-identity
checks are hard gates; timing deltas become engineering evidence for the next
iteration rather than an automatic pass/fail threshold.

The intended flywheel is:

`change -> six-platform HTTPS evidence -> cross-platform/history analysis -> hypothesis -> minimal change -> requalification`.
