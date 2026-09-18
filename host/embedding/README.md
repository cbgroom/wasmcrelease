# Host embeddings

`embedding/` describes execution environments that carry the same Host runtime and driver model.

Embeddings are not operating systems and do not define guest-visible Host APIs. They provide or bridge Host providers into the canonical runtime.

Current environments:

- `node/`
- `deno/`
- `bun/`
- `browser/`

The preferred desktop model is to reuse the native Host runtime/platform adapter when practical. Pure-environment providers are secondary implementations for environments where native bridging is unavailable or intentionally avoided.
