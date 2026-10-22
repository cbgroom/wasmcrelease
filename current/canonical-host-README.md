# Canonical Host compilation SDK

This is the v0.0.24 candidate SDK. The immutable release and channel receipts
determine publication and installation status.

Import `createCanonicalHostCompiler` from `current/canonical-host.mjs` and pass
the exact compiler bytes from the selected product. Call `compile` with ordinary
WAsmC source, its source-bound activation bytes, the exact entry and operation
contracts, and the selected complete Lib Root's Core/WIT/template bytes.
Each contract contains original `wit`, `executionAbi`, `providerContract` and
`binding` byte arrays. The SDK computes their digests without reserializing them.

The result contains the compiler's frame, descriptor and validated module bytes.
The embedding build tool seals them with the exact Root producer auxiliaries,
one matching CoreLib and its qualified merger. Compare the final imports with
the descriptor's exact Host contract before execution. Compilation grants no
Host capability and performs no application call.

The SDK validates the compiler, Root Core and every generated Core module using
the actual WebAssembly engine. Calls consume one request configuration and clear
it on success or failure. A compiler instance accepts one compilation at a time.
Dispose it when finished. Root selection, Host contracts, engine limits,
installation, application decisions and persistence remain caller responsibilities.

`node scripts/test-canonical-host-sdk.mjs` runs the included source/contract
conformance fixture. The same test supports Bun and Deno. It checks all eight
generated modules against the independently qualified Native frame, recovery
after rejection and a freshly bound source on the same compiler instance.
It does not invoke a real Host or establish platform installation acceptance.

The included fixture selects the complete JSON0.0.6 Root and its generated
producer assets. Its expected frame pins all eight modules and the exact
source-bound activation; the SDK itself remains package-independent.
