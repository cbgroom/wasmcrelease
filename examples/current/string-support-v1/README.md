# Current Rust-derived string support

Use this complete matching profile with the current compiler, CoreLib and installed wasmc-text0.0.1 Root. The existing30 Rust str/String/memchr operations are unchanged and are available through current Library-first search/resolve/install. Ordinary source uses text::trim, text::split, text::replace and related calls. No new compiler syntax or string algorithms are introduced.

CoreLib4.11.0-candidate.2 uses fallible Rust Vec storage in place of the old128KiB packed-byte and2MiB string pools. Core ABI and ownership/borrow/cleanup semantics remain unchanged. Growth is limited by actual allocator/Wasm memory and caller budgets; this does not promise unlimited memory. Native tests include2MiBbytes/9MiBUTF8 strings; dual-engine tests prove allocation denial and same-instance reuse.

The current canonical ingress has an independent1,048,576work-unit budget, including record/list traversal. It can reject an exact1MiB byte input before the Host byte-window bound. Preserve that rejection and recovery; CoreLib growth does not remove it. Large-input fuel observations belong to declared test budgets, not a fixed production service-fuel claim.

The complete App uses multi-memory. Node/Deno run ordinarySource checks; Bun1.3.14 verifies compiler frames only. Existing frozen Text001 bundle and prior releases retain their original Core/Compiler/profiles. Use the new complete profile instead of silently replacing bytes inside an old bundle. All callbacks in this fixture only copy supplied bytes and record responses; text processing and decisions execute in Guest/Lib.
