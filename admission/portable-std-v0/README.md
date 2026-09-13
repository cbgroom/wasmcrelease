# Portable Std qualification candidate

This is a public **qualification candidate**, not an immutable release, default
Catalog selection or production pointer. Pin a full public commit and verify
SHA256SUMS. Existing Std1.4.0 and v0.0.10 product bytes remain frozen.

The regenerated `package/` is `wasmc:std@1.4.1`:73 unchanged semantic APIs,
Core ABI epoch1, matching CoreLib4.8.0. WIT, generated Rust SDK, plans, Component
and both callers were regenerated together, not renamed from the old package.
The Core root is44201bytes and removes the old optimizer's function-reference
and tail-call requirements. `manifest.json` binds every byte, the exact private
source authority, toolchain, output envelope and local qualification.
CoreLib owns memory; scalar/opaque references are not shared-everything memory.

## Copy-run-verify

```bash
node admission/portable-std-v0/test.mjs
node admission/portable-std-v0/test-checkout.mjs
bun admission/portable-std-v0/test.mjs
deno run --allow-read --allow-env=GITHUB_SHA admission/portable-std-v0/test.mjs
cargo test --locked --manifest-path host/lib-e2e/rust/Cargo.toml --test portable_std
cargo test --locked --manifest-path host/lib-e2e/rust/Cargo.toml --test portable_std --features wasmtime-engine
```

All files are identity-checked and complete Core modules validated **before**
instantiation. Tests execute2560calls for each independent Rust/WAsmC caller
in matching isolated CoreLib domains:20vectors,128rounds. JS additionally tests
13rejection controls, import surfaces, SDK namespace mismatch and frozen64-file
product integrity. Node18 must reject the original1.4.0 negative control while
accepting and executing the new root. Wasmi2 and Wasmtime47 run actual modules.
No private compiler/Lib source is downloaded or rebuilt by public Actions;
only open integration code is compiled against admitted binary products.

Local private qualification passed10/10 unfiltered Std tests and5120paired
calls per engine under Wasmi2, Wasmtime47, Node18.19.1, Node26.5.1, Bun1.3.14
and Deno2.9.4. These are exact tested versions, not arbitrary minimum guarantees.
Actions independently qualify Linux/macOS/Windows against the exact public SHA
and retain receipts. Read the run status before calling cross-platform PASS.

This representative73-API root corpus is not exhaustive standalone edge testing
of all73functions. Core parity does not prove portable Component internals,
browser Host globals, mobile-device execution, TLS or Ultra/System closure.
Follow `package/SKILL.md`, `package/lib.wit` and the generated safe Rust SDK;
raw handle/status exports are private test/linking mechanics, not Agent APIs.
Catalog/embedded search and formal dev→main→prod promotion remain separate;
do not silently use this candidate as current prod.

The initial public run rejected Windows inputs because Git checkout changed
LF text into CRLF, violating package hashes before execution. `.gitattributes`
now disables checkout text conversion for all digest-bound delivery bytes;
a CRLF transformation negative test still rejects. This is a delivery fix,
not relaxed integrity or a rebuilt product. Generated SDK bytes (including
their final empty line) remain exactly the privately qualified inventory.
