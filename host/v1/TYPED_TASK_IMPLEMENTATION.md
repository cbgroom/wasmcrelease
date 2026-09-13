# Typed Host task implementation basis

This is an implementation proposal under the existing Host goal, not a new
accepted ABI, language family or completed SDK. The owning candidate remains
[host.wit](host.wit) and the twelve-family baseline remains unchanged.

## Reproduced current delivery boundary

```sh
node host/v1/typed-task-boundary-test.mjs
bun host/v1/typed-task-boundary-test.mjs
deno run --allow-read host/v1/typed-task-boundary-test.mjs
```

Against the admitted compiler and unchanged standard typed-resource plan:

- The existing synchronous standard owned-resource App compiles (2580 bytes).
- The existing scalar async file App compiles, with no physical imports.
- An ordinary owned local constructed before an await is rejected.
- An await returning an ordinary owned resource is rejected.

Both rejected shapes report that sequential await results must bind to s32
locals. These are compile boundaries, not execution or memory-safety tests.
The diagnostic does not establish that all possible async resource shapes fail,
nor that the entire private producer lacks newer capability. It establishes
that this delivered compiler cannot compile the two representative shapes.
Receipts bind compiler, plan and source digests and deliberately report
`accepted=false`. A successful characterization does not increase Host maturity.

## Why more embedding callbacks do not close the goal

The file/network fixtures bind scalar effects to captured JS resource objects.
That proves real transport mechanics, but the App does not own a typed window,
endpoint or operation in those callbacks. Repeating this fixture pattern cannot
prove an ordinary WAsmC/Rust resource SDK. An anonymous record containing a
numeric token is not a replacement: it exposes forgeable identity and omits
ownership, result claiming and lifetime checks.

The existing source vocabulary should suffice. The missing generic machinery
must retain typed owned/borrowed lifetimes across suspension; it must not add a
Host-specific resource name, operation name, source hash or fixture branch.
Compiler changes remain private. Reviewed Host glue/SDK and tests may be public.

## Required implementation sequence

1. Inspect current private generic typed-resource/task mechanisms and applicable
   maintainer contracts. Reproduce these shapes against the exact private
   candidate before deciding its missing implementation. Preserve disk and
   workstream ownership constraints; do not rebuild in an unbounded cache pool.
2. Establish a durable private task-start checkpoint before implementation.
   Review a single generic Core mapping: identities remain SDK/compiler-private,
   expected failures remain typed, passive wait correlates and never transfers
   owned payloads, and borrowed release preserves ownership on busy/failure.
3. Save continuation values and cleanup obligations in the compatible CoreLib
   domain. The compiler types and lowers hidden retain/move/borrow/drop; it does
   not become an allocator or container implementation. Reject borrows whose
   owner cannot remain pinned safely. Preserve old published task identity;
   assign a new physical identity if the actual carrier changes.
4. Generate the same WIT/Core contract for dependency-free Rust and ordinary
   WAsmC callers. Both consumers must hide identity and cleanup, including
   failed acquisition, terminal error, dropped result, cancellation and trap.
5. Bind JS and Native to the same resource/completion kernel. Use actual
   readiness, not a blocking file reference relabeled async. Never-settling
   operations require bounded outer containment; timeout is not force-free.
6. Execute the same real file/Lib/sync and resident TCP/UDP journeys, plus
   late-completion, failed-close, quota and stale/foreign-resource controls.
   Bind exact source/artifact/environment receipts and independently review
   them before main/release acceptance.

TLS and browser/device profiles remain separate full-goal gates. Bun's missing
Node-compatible reverse half-close remains explicit, not an invented backend
success. This proposal does not shrink the goal to two compile controls or to
the transport profiles that already pass.
