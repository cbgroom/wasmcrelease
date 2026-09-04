# wasmc Runtime / Registry — public v0.0.5 surface

This directory is the additive Runtime bootstrap introduced by public `v0.0.5`.

The primary package is `wasmc-runtime-v0/`:

```bash
cd wasmc-runtime-v0
node bootstrap.mjs self-test
node bootstrap.mjs compile --input examples/add.wasmc --output /tmp/add.wasm
```

It contains the current import-free Core compiler plus thin Node, Bun, and Deno Host adapters. It does not require npm or another external JavaScript package registry. Node and Deno self-tests are recorded in package receipts; Bun has the same adapter shape but was not independently live-run on the publishing host.

`registry-v0/` is a repo-local registry/channel/mirror description for `wasmc:runtime@0.1.0-runtime-v0`. Its internal `dev` label is resolver metadata, not the public update channel. The immutable outer `v0.0.5` tag/full commit is the release authority.

Current compiler identity:

```text
bytes   1484773
sha256  c96ee185af38febf197467acefa3389a076b0eef9c54d6ac4ba7d25397bcbd3b
```

Verify the package `manifest.json`, `receipts/compiler-wasm.json`, and repository `SHA256SUMS` before use.
