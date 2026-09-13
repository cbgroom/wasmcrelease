# Resident App input ownership

The mutable curated App/owned-algorithms Host fixture captures array length and
each indexed byte once before writing to its private Lib marshalling slab.
It never trusts caller iterators or `forEach`, nor rereads source data after
validation. The reproduced old path returned256 for a byte getter validated
as7. Overridden traversal could bypass the checked indices entirely.

The App is exclusively busy during capture and execution. Reentrant call fails,
and reentrant release cannot free the slab. Preissue malformed data/getter failure
makes no Lib call and leaves the App usable. After attempted Core execution traps,
the App stays poisoned and cannot replay; ordinary release still frees its slab.

`resident-snapshot-test.mjs` asserts nine cases in Node/Bun/restricted Deno:
getter and Proxy length capture, misleading iterator, overridden traversal,
sparse input, call/release reentry, throwing getter, oversized data and poison.
The browser additionally requires three capture/traversal/reentry controls.
Real TCP server regressions still require19 frames/17 calls/2 rejections and1000
resident calls. These are copying curated Host mechanics, not hostile module
admission, typed Agent SDK, shared-memory/zero-copy or full Std Wasmi proof.
