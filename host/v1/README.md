# Host v1 semantic review candidate

[host.wit](host.wit) is a **review candidate**, not the accepted Core carrier,
SDK, baseline replacement or release. The twelve top-level functions express
the existing mechanism families. Resource methods are explicit carrier helpers:
`window.copy-out` and `operation.take-result`; resource lifetime glue must also
be counted when reviewing physical Core signatures. Twelve families does not
mean twelve physical imports.

The contract preserves these ownership rules:

- `wait` borrows selected operations and returns passive receipts correlated by
  selection index. That index is not an endpoint/window/operation identity.
- `take-result` claims the terminal payload once, including terminal errors.
  An accepted endpoint is owned by its operation until this transfer. Repeated
  waits cannot duplicate an owned endpoint. Claiming is not retirement.
- `release` borrows its resource reference. Busy or failed retirement leaves
  ownership with the caller. A successful pending retirement returns an owned
  operation; resource drop delegates supervision, never proves physical close.
- Wait uses an absolute monotonic deadline; timeout ends only the wait. Cancel
  suppresses delivery without claiming rollback or releasing backend pins.
- Windows copy initialized bytes only. Guest memory pointers, registry IDs,
  raw handles and algorithm allocation are not application APIs.

`accept` and `finish-write` are finite negotiated controls, not arbitrary native
dispatch. An implementation must report unsupported rather than emulate an
unavailable transport. The description includes identity and budgets, but the
exact ABI epoch is not assigned by this candidate.

## Structural validation

Use the official `wasm-tools` tooling; outputs below are disposable templates,
**not runnable Host implementations or shipped artifacts**:

```sh
wasm-tools component wit host/v1 --wasm -o target/nonblocking-read/host-v1-wit.wasm
wasm-tools validate target/nonblocking-read/host-v1-wit.wasm
wasm-tools component embed host/v1 --world host-contract --dummy -o target/nonblocking-read/host-v1-dummy.wasm
wasm-tools component new target/nonblocking-read/host-v1-dummy.wasm -o target/nonblocking-read/host-v1-component.wasm
wasm-tools validate target/nonblocking-read/host-v1-component.wasm
```

These checks verify WIT resolution and Component type/canonical encoding, not
ownership enforcement by a real backend, Core ABI performance or no-JIT SDK
support. Component wrapping remains a compatibility view, not the primary
Core hot path.

## Remaining production work

The [JS session](../session/README.md) has opaque resources and one-shot result
claims but still uses relative wait timeouts, embedding-injected authority,
fixed transfer metadata and blocking retirement. It does not yet implement
this WIT's negotiated description or finish-write. JS listener accept now
transfers an opaque endpoint through one-shot result claiming, while its
blocking retirement shape still differs. Native's scalar file task is not the
shared typed session.

Before acceptance: review a deterministic Core mapping and generated typed
WAsmC/Rust consumers; align JS/Native ownership, deadlines and budgets; prove
real readiness, failed-close and never-settling containment; execute the same
file and resident network journeys across supported engines. TLS and browser/
device profiles remain separate uncompleted delivery gates. No fixture pass
sets `runtime_abi_accepted` or changes the baseline's pending WIT authority.
