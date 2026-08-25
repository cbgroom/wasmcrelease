# FastAPI availability

This file answers one question: can a new Agent write managed WAsmC source and
turn it into a runnable public product using this release?

For `v0.0.2`, the answer is **no**.

## What is shipped

- `dist/fastapi_core.wasm`: import-free FastAPI Core Provider 4.3.0.
- `dist/fastapi_core.json`: exact provider metadata and Core signatures.
- `loadFastApiCoreBytes` and `FASTAPI_CORE_URL` in the JavaScript facade.
- Rust demo code that validates and initializes the matching provider in an
  isolated Store.

This proves that matching provider bytes can be distributed, loaded, validated,
and initialized. It does not prove that arbitrary managed source can be built,
linked, initialized, invoked, and retired through the public package.

## What is not shipped

- no public `compileFastapi(source)` facade export;
- no public high-level managed-source compile/link/instantiate entrypoint;
- no complete public managed program example using `string`, `list<T>`, maps,
  identity-bearing objects, or managed option/result/variant payloads;
- no stable public SDK abstraction over provider-private lifecycle operations.

Therefore an Agent writing new `v0.0.2` source must stay on the direct Core-lane
path documented in `LANGUAGE.md`, or use a reviewed prebuilt managed caller
supplied by its application. Do not substitute private tooling or reconstruct
the provider protocol from metadata.

## Why the provider is still published

Compiler, facade, provider, and metadata are published atomically so reviewed
prebuilt callers can pin one exact provider contract and so Host integrators can
validate the future delivery boundary. The provider is a pure-compute managed
value heap, not HTTP, a network service, or ambient Host authority.

## Public managed-source acceptance gate

A later release may mark managed source as shipped only when all of these are
present in the same immutable candidate:

1. a documented public facade entrypoint that accepts ordinary WAsmC source;
2. compiler and exact provider bytes selected automatically as one bundle;
3. a complete copyable link/init/invoke/cleanup journey;
4. executable `string`, list, map, and managed-object examples;
5. JS and Rust Host guidance that hides provider-private handles and lifecycle;
6. import, behavior, checksum, and zero-context Agent validation.

Until then, `AGENTS.md` must continue to label general managed-source use as
unavailable, even if the private compiler authority has implemented more.
