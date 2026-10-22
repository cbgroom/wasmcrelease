# WAsmC 0.0.24 product evidence

`release.json`, immutable channel receipts and the public release determine publication. The candidate files and the checks described here remain separate from that publication evidence. Earlier immutable tags and their original artifacts remain available with their accompanying identities.

## Ordinary source and the reusable library path

Ordinary WAsmC source can call an admitted JSON Lib through the generic Canonical Host compiler/SDK path. The SDK supplies the selected Lib and exact application-owned Host contracts, and the compiler emits eight modules with explicit memory and call bindings. The public conformance example is [examples/canonical-host](../examples/canonical-host/); it checks repeated compilation, failed-call recovery and rebinding a new source input. Application source uses the typed public API.

JSON 0.0.6 publishes 14 WIT-authoritative operations, including `utf8.encode`. Its complete Core and Component Root, generated Rust views and original dependency notices are provided together. Replacing the older current JSON identity gives 42 current Roots, 247 exported API routes and 289 search entries. The strict composition receipts identify the 41 reused Roots and the original JSON producer inputs; they do not describe a fresh rebuild of all 42 libraries.

The generic compiler fix preserves captured collection borrows across loops, including nested loops, `continue`, `break` and a later read. The generated canonical value bridge transfers strings in bounded blocks. JSON parsing, UTF-8 conversion, collection behavior and byte-read caching remain CoreLib/Lib/SDK responsibilities.

## Matching compiler and Core

The one portable compiler is 1,956,578 bytes, has no imports and has SHA256 `c78816376228b6091599845c6a9a531eb76f949fe419655c012ec30c05f75832`. Its actual product Source is `f869332b9bfa44d09ea1ae5bc95ad0d4d0c74816`. Versioned custody files distinguish that actual warm build from the canonical integration metadata. Public delivery contains the reviewed Wasm and integration glue; compiler implementation source remains private.

Core 4.9.1 uses raw provider SHA256 `7cd4f0c60536f1825da3fed9d525a43ee9724250203a261f298505a503e9bcbf`. Its 47 public function signatures and the import namespace `wasmc:lib/wasmc.lib_managed_object_heap@4.9.0` remain compatible. It caches validated successful reads and reuses checked allocation hints. The earlier Core 4.9.0 artifact remains unchanged. Std 1.4.1 and the other reused Roots retain their original bytes and evidence.

## Execution evidence and release boundaries

The ordinary Guest path parses external JSON/bytes, makes its decision inside the Guest, performs the admitted atomic write and returns the complete response bytes. A pure Host fixture passed all 19 original cases at the unchanged 10-million fuel, 64 MiB memory, 64 Host-call and five-second limits. Successful cases wrote both complete fixture rows; failure cases wrote none, error handles were released once and all pending resource counters returned to zero. The final portable App is byte-exact with that qualified Native App. Fixture transactions do not establish a real installation or persistence result; those require the separate normal Source build/install and same-installed-artifact new-input receipts.

The compiler-family qualification records the actual Node, Bun and Deno results for the final manifest, including CLI outputs, Std execution, managed values, private helpers and canonical frame conformance. Native CLI packages must retain their actual source commit, target, compiler and independently downloaded-consumer results. Old compiler packages are not relabeled as this successor.

Whole-product candidate freeze, unchanged digest-set promotion, the authorized GLM 5.3 Flash single-model regression with independent review, immutable publication and public download verification each retain their own receipts. The single-model policy does not claim that the historical two-model cohort passed. Consult the current authority files for completed stages and exact immutable selections.
