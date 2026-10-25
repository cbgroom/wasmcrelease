# WAsmC v0.0.29

Completes existing canonical SDK composition of checked u32 and unit Host calls with managed Result/error Variant values. Direct typed Result locals and read-only matching preserve ordinary source semantics. SDK windows supply scalar/string argument transfer, full u32 bits, unit status validation and owned-error cleanup. CoreLib storage, Rust-derived Lib algorithms, public WIT/Host contracts and existing JSON007/Text001 releases remain unchanged.

Run node scripts/test-canonical-checked-results.mjs, also Deno and Bun. Every host verifies four actual compiler frames and eight modules with source rejection/recovery. Node and Deno additionally execute 800 fresh-input calls each in the same installed App, covering five error cases, high-bit handles, malformed responses and three zero pending counters. Wasmtime49 and Wasmi2 independently qualified the identical App with 4000 and800 calls. All Host effects are in-memory conformance callbacks.

The complete canonical App requires multi-memory. Bun1.3.14 verifies compiler outputs but does not execute this App profile; this is an existing canonical packaging requirement, not a claim of Bun runtime parity. An attempted standard Binaryen single-memory transform failed initialization and is not shipped. No compiler frame postprocessing, memory rewrite, manual module substitution or new language family is included.

The immutable published JSON0.0.7 Root remains separately selected by the fixture. The42 current catalog Roots, Std and CoreLib are preserved. Plain arbitrary nested error-branch calls, moving a borrowed request body and list<string> indexing in this aggregate composition profile remain unsupported. Prefer existing Lib helpers; parsed JSON normalization may change object-key byte order.

Compiler, JS, Runtime and Native delivery artifacts select one new current compiler identity. Formal release authority and installed behavior come from the immutable tag, channels and official downloaded artifacts. Candidate/source/qualification records alone do not publish or activate a platform.
