# wasmc runtime package v0

This package is distributed by the wasmc registry/mirror channel, not by an external JS package registry. The JavaScript files are thin Host adapters for existing runtimes. The compiler/tool core is `compiler.wasm`.

Run with Node:

```text
node bootstrap.mjs self-test
node bootstrap.mjs compile --input examples/add.wasmc --output target/add.wasm
```

Bun and Deno are Host providers for the same package shape:

```text
bun bootstrap.mjs self-test
deno run --allow-read --allow-write bootstrap.mjs self-test
```

Host adapters must stay thin. Tool semantics belong in wasmc kernels and Core Wasm; filesystem, process, HTTP, hashing, and Git remain explicit Host authorities.
