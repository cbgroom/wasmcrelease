# Core Host v0 — public design and executable reference

Experimental standardization prototype, not stable ABI or production I/O SDK.
No dependency on WASI0.3 or Component execution. Core Wasm is the execution
boundary; WIT remains the intended typed semantic authority above transport.
The public source covers only integration/Host mechanics, not compiler internals.

## Design constraint

Keep Native low-frequency evolving, not permanently frozen. New protocols,
algorithms and policy should normally ship as CoreLib changes. Add a Host
primitive only for an irreducible external operation or an evidenced security,
correctness or performance requirement. A universal opcode must not conceal
per-business native changes. JS and Native share semantics where possible;
Native acceleration and platform-specific capability need not be limited by JS.

The draft twelve operations are describe/open/read/write/invoke/wait/cancel/
release/window-acquire/window-commit/clock-read/entropy-fill. They are mechanism
families, not a promise every endpoint supports everything. Capabilities are
explicitly injected, children cannot gain authority, unsupported features reject.
`host.wit` is a parser-validated semantic draft, not an implemented adapter or
Component requirement. Release ownership while busy, per-operation batch
completion identity and feature negotiation need review before ABI acceptance.
Do not infer WIT/Core physical equivalence from this draft.
Platform/device contracts still need their own typed operation and durability
semantics. No arbitrary JSON RPC or ambient OS/WASI authority is introduced.

## Implemented initial profile

`contract.json` separates draft semantic operations from seven implemented
reference operations. Two independent state machines implement one bounded
memory-device write. JS is Node-free ESM suitable for browser embedding; Rust
owns its own implementation. Both use copying, not zero-copy/shared memory.
`open/read/write/clock/entropy` are not implemented; unknown operations return
unsupported, never synthetic time/entropy or silent network fallback.

For controlled fixtures only: injected endpoint1 is writable and endpoint2
read-only. Acquired windows contain byte42 so both implementations have fixed
input data. Commit sets valid length; invoke transfers the committed snapshot
to a pending operation and makes the window inaccessible to mutation/release.
Wait applies the effect exactly once and unpins the window. Repeated wait reads
the same completion without reapplying. Cancel wins only before completion,
unpins the window and guarantees this simulator has not applied the effect;
wait then reports cancelled. Real backends may report an outcome that cannot
be undone and must not inherit that simulator guarantee. Pending operations
cannot be released. Terminal operations and unpinned windows require explicit
release. Retired tokens are never reused within one reference session.

Limits: eight live windows, eight operation records including terminal records,
sixteen bytes/window. The low-level fixture uses session-local integer tokens,
not application-visible API or transferable capabilities. Cross-session identity,
capability revocation, arbitrary buffer access, batch/deadline/wakeup semantics
and typed WIT SDK generation remain unclosed. `wait` is deterministic simulator
progress, not real event-loop blocking. `describe` currently reports only
fixture rights, not full version/feature negotiation. `invoke` supports exactly
the memory-write operation; it is not an extensible arbitrary dispatch service.

## Reproduce

```
cargo build --locked --manifest-path host/v0/rust/Cargo.toml
node host/v0/test.mjs host/v0/rust/target/debug/wasmc-host-contract-reference
node host/v0/core-test.mjs host/v0/rust/target/debug/wasmc-host-contract-reference
```

The first command pair compares104 scenarios/10037 transitions, checking
responses, live resource counts and device bytes at every transition. Explicit
oracles cover completion, denial, bounds, busy release and cancellation; random
adversarial traces are deterministic, not an exhaustive proof.
The Core test compiles the public WAsmC guest once and executes those same bytes
in JS WebAssembly and native Wasmi2 for four lengths; both clean up all resources.
Windows executable names have `.exe`. Tests grant no real external capability.

Actions cover Node/Bun/Deno and native desktop runners; logs identify the exact
source and simulator scope. Browser-specific execution, real OS/device backends,
Wasmtime parity, cancellation races and performance qualification are subsequent
gates. This prototype does not replace the existing Runtime SDK or old release
artifacts, and existing immutable tags remain unchanged.

Next: review draft semantic WIT and define negotiated Core transport; one session-bound
resource model; browser/Wasmtime parity; real restricted backend with deadlines,
revocation and late-completion fault tests. Only then consider shared-window
and batch acceleration. Internal String/List/Map allocation stays in CoreLib.
