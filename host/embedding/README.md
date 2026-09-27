# Host embeddings

`embedding/` describes execution environments that carry the same fixed,
domain-neutral Host boundary.

Embeddings are not operating systems and do not define guest-visible domain
APIs. They execute Lib-owned descriptors through the canonical boundary.

Current environments:

- `node/`
- `deno/`
- `bun/`
- `browser/`

The preferred desktop model is to reuse the native boundary executor when
practical. A pure-environment executor implements the same mechanisms when
native bridging is unavailable or intentionally avoided.
