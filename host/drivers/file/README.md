# Preopened file I/O — experimental real backend

This public backend exercises actual OS file I/O, not the v0 memory simulator.
It is a limited Host adapter, not a production sandbox or completed Core/WIT
transport. Existing compiler/CoreLib products and immutable tags are unchanged.

The embedding Host supplies an already-open exclusive file handle and read-only
or read/write rights. No guest path resolver, directory traversal, arbitrary
filesystem access, certificate syscall or system TLS dependency is introduced.
JS implements asynchronous file calls; native Rust uses exclusive file access.
Their common contract is positional read/write, explicit storage sync and release.
`invokeSync`/`invoke_sync` maps to a typed storage operation under draft `invoke`,
not a new universal Host primitive. Creating a fixture file is trusted harness
configuration, outside the guest API; it uses exclusive creation without clobber.

Initial profile limits:16bytes/call,64-byte accessible range, one preopened
resource per harness run. These deliberately small test budgets are not an
application throughput or certificate-bundle size limit for a future SDK.
Read returns the available prefix, including EOF.
Backend read completion length must be an integer in0..requested. Invalid,
negative, fractional or oversized completion rejects -8 without publishing
bytes or repeating I/O. Run `node host/drivers/file/read-completion-test.mjs` (Bun/
permission-free Deno also work) for five invalid and three valid controls.
Write completes all supplied bytes or reports possibly partial/unknown effects;
no implicit rollback/retry.
Release invalidates the resource. Explicit sync uses FileHandle.sync / sync_all;
it does not prove directory-entry durability, crash recovery or every filesystem's
power-loss behavior. Native drop closes the descriptor but cannot report every
OS close error; release is not a durability barrier.

Error codes: invalid-resource -1, permission-denied -2, bounds -5,
unsupported -7, external failure -8, possible partial write -9. Validation and
rights rejection precede I/O. These are an adapter profile, not the frozen v0
simulator error table or an accepted physical ABI.

```
cargo build --locked --manifest-path host/drivers/file/rust/Cargo.toml
node host/drivers/file/test.mjs host/drivers/file/rust/target/debug/wasmc-preopened-file-reference
```

The independent JS and native implementations execute20 operations across
read/write and read-only profiles, each checked against explicit expected
results and independently read final disk bytes. Two native reopen attempts
reject existing files and preserve contents. Bun and Deno run the same tests;
Windows native binary suffix is `.exe`. Fixture JSON is test transport, not a
proposed JSON RPC Host ABI. Test cleanup removes only its owned temporary files.

The JS adapter is trusted Host code, not a sandbox for arbitrary JS callers.
Guest-capability/session tokens, window binding, Core guest asynchronous
continuations, deadline/revocation/partial-I/O fault testing, browser and live
TCP/UDP/TLS are subsequent work. Browser cannot use this Node-style OS file
adapter unchanged; browser-specific storage permissions need their own adapter.
Native's OS file bindings are necessary external mechanisms, not a dependency
on a platform TLS engine. No false all-platform/browser production claim.

Next: map preopened resources to session-bound handles and bounded windows;
bind completion-aware Core transport; qualify restricted TCP/UDP and resident
service. Reusable certificate parsing/location/trust policy and TLS remain in
Libs where existing external primitives suffice.

## In-flight access

JS writes capture at most16 bytes before issuing I/O, reading each array index
once. Caller mutation during a partial write cannot change subsequent bytes or
the reported length. Each backend acknowledgement must be an integer in
1..remaining; malformed acknowledgement reports -9 after possibly external
effects, without replay. Partial-progress continuation writes only the remaining
owned suffix. Local acknowledgement is not storage durability; sync is separate.
Run `node host/drivers/file/write-snapshot-test.mjs` (also Bun/permission-free Deno)
for seven mutation/getter/malformed-completion controls. These controlled seams
are not OS fault/recovery qualification.

The JS adapter rejects concurrent read/write/sync/release with busy (-4) until
the issued operation settles. In particular, release cannot close a descriptor
still used by I/O. Rust's exclusive mutable borrow supplies this serialization.
This is trusted owner discipline, not protection against a caller directly
closing the underlying file outside the adapter or general OS fault recovery.
