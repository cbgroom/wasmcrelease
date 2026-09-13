# Next gate: typed Core transport, not another Host-only fixture

This is an implementation review checklist, not an accepted ABI or SDK. The
[five Host delivery gates](v0/README.md) still accept only gate1. Real file,
TCP/UDP, browser and lifetime receipts qualify their stated slices, not gate2.

## What is missing

Current real-I/O drivers consume trusted endpoints outside the Core App. The
curated App calls a small `sum_window` transport, then a reviewed computation
Lib. The seven Kernel Core imports execute a bounded memory simulator. Neither
proves an ordinary typed App can initiate general asynchronous endpoint I/O.
`host.wit` remains a semantic draft, not those physical imports or a JS FFI.

The next representative test must start from an ordinary typed App, use the
same logical contract from WAsmC and Rust, perform a restricted real effect,
and prove ownership/limits/cancellation through the entire lifecycle. Raw
curated fixtures and a successful WIT parse are insufficient substitutes.

## Review before implementing or freezing

1. Resolve one exact WIT semantic contract and finite data-only resource plan.
   Prove existing generic typing/lifetime/lowering can consume it; do not add
   package/method/source-specific compiler dispatch. Only a demonstrated real
   blocker can justify compiler semantics work. Storage/algorithms remain Lib.
2. Specify scalar/status carriers, exact provider/ABI identity and scoped
   endpoint/window/operation lookup. Agent code must not manufacture handles,
   bind numeric opcodes or choose private allocation/layout. No Rust ABI.
3. Associate every batch completion with its operation, including failure,
   cancellation, partial external effect and unknown outcome. The WIT draft's
   `wait`/`completion` shapes do not yet establish that physical protocol.
4. Review transfer/drop/release semantics while busy. No successful ownership
   transfer, zero diagnostic count or timeout may stand in for an issued-I/O
   stop/close/internal-release acknowledgement. Hidden SDK cleanup must retain
   quarantine and quota, suppress delivery and never replay external effects.
5. Keep engine choice invisible and measured. Wasmi completion and eligible
   Wasmtime future calls must obey the same capability/error/cleanup contract;
   no state migration, replay or silent portability fallback. Full Std portable
   Wasmi remains a separate unresolved dependency; Heap-only is not full Std.
6. Qualify source/API bindings, adversarial resource/completion tests, real
   restricted I/O and selected browser/Native/mobile scopes independently.
   Cross-compilation is not link/install/device proof. Gate5 still needs full
   performance/memory and immutable SDK release acceptance.

## Source boundary

Public Host/native/JS glue can evolve here. Compiler/CoreLib/package/guest-SDK
producer authority does not move to this source-free repository. A new Std
portable artifact must be built and qualified in the private producer, not
rewritten from frozen Lib bytes here. A formal typed package/SDK likewise needs
its owning production workstream and exact artifact/binding evidence. This
review authorizes no private-source mutation, artifact replacement, new syscall,
release tag, discovery pointer or deployment.
