# WAsmC release channel

Public binary packages and integration wrappers for the source-private WAsmC
compiler.

This repository is a distribution channel, not the compiler source or build
authority. Every version uses one standard Core Wasm compiler digest shared by
the raw Wasm, JavaScript sidecar, and executable Rust Wasmtime demo. Immutable
repository tags are also served through jsDelivr's GitHub CDN.

The current initial development release is `v0.0.2`. It contains the canonical compiler
Core Wasm, the matching import-free FastAPI Core 4.3 provider, a small
JavaScript facade, a complete plain-Wasmtime Rust demo, and executable Agent
source-writing guidance. Pin `v0.0.2` or its
full commit and verify `SHA256SUMS`; `latest` and `main` are mutable discovery
aliases, not reproducible identities.

Mutable `main` may contain post-release documentation or maintainer changes.
Use the immutable tag when documentation must match an exact released package.

Version `0.0.x` is formally published but intentionally not API-stable. See
[RELEASES.md](RELEASES.md) and [package-index.json](package-index.json) for the
release channel. Coding agents should start with [AGENTS.md](AGENTS.md), which
routes source writing, JavaScript/raw Wasm/Rust hosting, and FastAPI availability.

- [Write WAsmC](LANGUAGE.md)
- [Host the compiler](HOSTING.md)
- [Understand current FastAPI availability](FASTAPI.md)
- [Run the Agent start examples](examples/agent-start/README.md)

Repository maintainers start at [.agents/MAINTAINERS.md](.agents/MAINTAINERS.md).
