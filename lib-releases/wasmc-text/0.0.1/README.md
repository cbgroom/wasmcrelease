# Rust-derived ordinary Text Lib 0.0.1

Thirty coarse operations directly reuse Rust str/String and pinned memchr2.8.0. Ordinary source calls text::trim(value), text::split(value,separator), text::replace(value,from,to), etc through the existing generated Lib caller. No compiler/CoreLib source or new method syntax is needed. The current ordinary string .method path remains its previously published subset.

WIT lib.wit is authoritative. Rust borrowed substrings become independent owned String results; split/lines iterators become eager list<string>. Indices/counts use Wasm32 u32. get-or uses UTF8 byte start/end with an exclusive end: invalid range or character boundary returns exactly the caller fallback. find/rfind return UTF8 byte offsets. Empty patterns, trailing split empties, Unicode whitespace and case expansion follow Rust. eq-ignore-ascii-case is ASCII-only; no locale, grapheme or Unicode normalization claim. from-utf8-or is strict (exact caller fallback on invalid bytes); from-utf8-lossy explicitly substitutes U+FFFD. Native allocations, input/output/list transport and fuel obey the actual runtime; no arbitrary tiny text cap or unlimited-memory claim.

The value API crosses the existing Canonical transport and copies inputs/results at that boundary. This is not a resident zero-copy String API. Each scan/transform executes as a coarse Lib operation; do not implement text processing with per-byte Host calls. Allocation failure traps follow ordinary Rust/runtime behavior; no partial returned result is published.

Generated Core and Component SDKs are distinct views. Native Rust tests alone are insufficient: normal build/strict reopen, reproducible Roots and actual ordinary WAsmC plus Component execution must precede formal publication. Existing JSON007 utf8.encode-parts-or remains unchanged for explicitly bounded byte assembly.

Current ordinary source cannot match owned option<string> payloads. The four -or operations use existing explicit fallback conventions instead of extending the compiler: get-or, strip-prefix-or, strip-suffix-or and from-utf8-or. They return exactly fallback on absence/error, without a separate status; empty successful output remains empty. There is one public form per operation, no optional/fallback API twins. find/rfind retain option<u32> and scalar matching.

## Complete published bundle

Run `node verify.mjs` after extraction. The compiler/SDK/Core/root/cold assets form one exact tuple; select it together. Ordinary full source is app/source.wasmc. The verifier checks every byte, compiles source, verifies rejection/recovery/source rebinding, and executes34cases16rounds on the same App with exactly13mock HTTP Host imports and both pending counterszero. It makes no external platform effects.

Node/Deno execute the complete journey. Bun1.3.14 supports the compiler stage only; use `bun verify.mjs --compiler-only`, which earns no Guest credit. Compiler Latest remains v0.0.27, existing current catalogs are unchanged, and this standalone Lib is selected explicitly. Installation does not establish idev/Green deployment.
