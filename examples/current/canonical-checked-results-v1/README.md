# Canonical checked Result conformance

Ordinary WAsmC invokes caller-selected checked u32/unit operations through the existing canonical SDK managed Result path. Source uses direct typed Result bindings, full u32 values and read-only nested error Variant matching. JSON parsing and UTF-8 belong to the immutable published JSON0.0.7 Lib Root in lib-releases/wasmc-json/0.0.7; CoreLib storage and existing public Host contracts remain unchanged.

The current portable compiler emits eight modules. expected.json binds those modules, the immutable Root/Host tuple, prepared SDK transfer/Lib assets and exact ordered merge recipe for app.wasm. transfer.rs is generated public Lib consumer glue, not compiler implementation. The complete App matches the independently qualified Native composition. It requires a multi-memory engine. Node26/Deno2/Wasmi2/Wasmtime49 execute this profile; Bun1.3.14 verifies the compiler frames but cannot execute the complete App. No memory-lowering transform or replacement is shipped.

Run node scripts/test-canonical-checked-results.mjs (also Bun/Deno). The test recompiles ordinary Source, compares all eight outputs, checks compile rejection/recovery and, on an admitted multi-memory engine, executes the same installed App with fresh dynamic JSON/path inputs and in-memory callbacks only. It covers success, five error variants, high u32 bits, unit status, owned-error cleanup and same-instance recovery. It performs no real Service/storage/network operation and does not execute a supplied business Guest.

This finite profile admits scalar u32/UTF8 string arguments for checked scalar/unit operations. Use direct typed locals for Result matches. Arbitrary nested error-branch calls, borrowed request-body moves and list<string> indexing in this aggregate composition profile remain unsupported; prefer existing Lib operations. A successful fixture does not activate any platform capability.


## Matching SDK tuple and ordinary Source binding

Use checked-profile.json as one exact profile. Its selected operations are service.invoke, table.response-len and table.response-drop; the unchanged JSON007 Root and original eight entry/operations buffers are mandatory. Use prepared-transfer.wasm with SHA256659a94935ba8849421f644392149adf3564af806985fa040698be6a02675f336 and cold_source_sha2569423aa9b5bc6b39eefc878489134aeadcb4184dabd8f1abf4688631e1dbc49a3. The matching prepared Lib is prepared-lib-core.wasm. The immutable JSON007 standalone cold profile selects a different bridge and must not be reused just by changing its selection.

The existing public facade is current/canonical-host.mjs. Read the profile, verify every path/hash, compute SHA256 of the actual UTF8 Source, and construct the existing activation object with schema wasmc.canonical-host-activation/v1, that source_sha256 and the profile's domain/root/entry_operation_selection/operation_selection/cold_transfer. Supply the profile's entry, operations, libCore, libWit and template bytes to createCanonicalHostCompiler(...).compile. The frozen activation.json is the neutral example only; it is not a reusable Source hash. The returned frame binds the selected prepared-cold identity. Seal with the exact prepared transfer/Lib/CoreLib and the original ordered merge recipe in expected.json.

These matching prepared assets are the supported consumer prepare path for this exact reviewed tuple. transfer.rs and raw-transfer.wasm preserve producer custody. A different Host/selection/public entry type requires a new matching SDK producer tuple; the frontend deliberately rejects an old producer hash instead of silently substituting one. No Root or Core mutation is authorized by preparing an activation.

The same exact selected tuple also compiles http-only.wasmc with only13actual HTTP imports. The test rejects the original standalone cold producer hash, then recovers with the matching new tuple. Changing selection or compiler alone never substitutes a matching prepared asset.
