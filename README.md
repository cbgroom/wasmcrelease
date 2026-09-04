# wasmc release channel

Source-free public packages for the private-source `wasmc` compiler.

Current release: `v0.0.5`. It adds a Python-free, package-manager-free `wasmc:runtime` bootstrap with `compiler.wasm`, Node/Bun/Deno Host adapters, and repo-local registry metadata. The v0.0.4 JavaScript/Lib compatibility trees are retained byte-for-byte. GitHub Actions is not part of the release path.

- Agents and developers: [AGENTS.md](AGENTS.md)
- Language delta: [LANGUAGE.md](LANGUAGE.md)
- Lib model and managed collections: [LIB.md](LIB.md)
- JavaScript, raw Wasm, and Wasmtime: [HOSTING.md](HOSTING.md)
- Runtime/Registry bootstrap: [runtime/README.md](runtime/README.md)
- Release history: [RELEASES.md](RELEASES.md)

Production consumers must pin `v0.0.5` or its full commit and verify `SHA256SUMS`. `main` and latest metadata are mutable discovery conveniences.
