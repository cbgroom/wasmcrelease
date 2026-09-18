# Bounded Host memory provider

The baseline memory capability is Host-owned bounded memory, not a guest-visible
native mapping. The same Rust implementation is used on Linux, macOS and Windows.

Semantics:

- fixed non-zero capacity selected by the Host;
- bounded offset read/write;
- no durability/flush semantic;
- no native pointer/address/allocator identity crosses the Host boundary;
- retirement invalidates the provider exactly once;
- platform-specific shared-memory/mmap providers, when needed, are additive
  implementations behind the same capability and lifecycle.

This keeps the portable memory contract separate from OS-specific acquisition.
