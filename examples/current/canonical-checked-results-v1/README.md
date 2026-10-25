# Canonical checked Result conformance

Ordinary WAsmC invokes caller-selected checked u32/unit operations through the existing canonical SDK managed Result path. Source uses direct typed Result bindings, full u32 values and read-only nested error Variant matching. JSON parsing and UTF-8 belong to the immutable published JSON0.0.7 Lib Root in lib-releases/wasmc-json/0.0.7; CoreLib storage and existing public Host contracts remain unchanged.

The current portable compiler emits eight modules. expected.json binds those modules, the immutable Root/Host tuple, prepared SDK transfer/Lib assets and exact ordered merge recipe for app.wasm. transfer.rs is generated public Lib consumer glue, not compiler implementation. The complete App matches the independently qualified Native composition. It requires a multi-memory engine. Node26/Deno2/Wasmi2/Wasmtime49 execute this profile; Bun1.3.14 verifies the compiler frames but cannot execute the complete App. No memory-lowering transform or replacement is shipped.

Run node scripts/test-canonical-checked-results.mjs (also Bun/Deno). The test recompiles ordinary Source, compares all eight outputs, checks compile rejection/recovery and, on an admitted multi-memory engine, executes the same installed App with fresh dynamic JSON/path inputs and in-memory callbacks only. It covers success, five error variants, high u32 bits, unit status, owned-error cleanup and same-instance recovery. It performs no real Service/storage/network operation and does not execute a supplied business Guest.

This finite profile admits scalar u32/UTF8 string arguments for checked scalar/unit operations. Use direct typed locals for Result matches. Arbitrary nested error-branch calls, borrowed request-body moves and list<string> indexing in this aggregate composition profile remain unsupported; prefer existing Lib operations. A successful fixture does not activate any platform capability.

