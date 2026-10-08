# WAsmC public Agent entrypoint

This file is frozen inside the v0.0.21
product set; product presence is not lifecycle authority. Start with
`agent-quickstart.json`. For release orientation, read the validated compact
`agent-release-orientation.json` and run its named check. Open the full artifact inventory
in `manifest.json` only if that check fails. `release.json` and
`channels/dev.json`, `channels/main.json`, `channels/prod.json` decide lifecycle.
Construct CDN URLs only after reading the exact tag from `release.json`.
Pin that immutable tag or a full public commit; mutable main is discovery.

## License boundary

Read `license-policy.json` and `LICENSE`, then run
`node scripts/validate-license-policy.mjs`. This product permits non-commercial
research only. Commercial and production use require a separate written license.
It is source-available, not open source. Earlier immutable artifacts retain
 their accompanying licenses and grants. Original dependency notices are
included in complete Roots and Native packages.

## Start here

Use one matching quickstart route and its named oracle. Report exact identities;
when an identity is needed, copy its complete value and never use
an ellipsis or placeholder. Do not broaden a successful task into release history.

For algorithms, text, bytes and collections, follow
[Library-first discovery](skills/wasmc-lib-discovery/SKILL.md): search, read the
selected Root Skill/WIT, approve exact identity, resolve/install, check imports
and engine, execute the behavior oracle, then write missing glue.
For source, Rust Lib authoring and compiler capability boundaries, read
[the developer Skill](skills/wasmc-developer/SKILL.md).
For Rust SDKs, CLI or embedding, follow
[SDK discovery](skills/wasmc-sdk-discovery/SKILL.md).
Read [the decision model](docs/AGENT_DECISION_MODEL.md) when a state transition
matters. Qualification is evidence, not admission. Admission, product inclusion,
release, discovery and installation each require their own authority.

Compiler implementation source is private. Reviewed compiler Wasm and public
Host/runtime/SDK/CLI integration glue may be distributed. Compiler modification
permission does not grant compiler-source publication permission.

## v0.0.21 product capability contract

The product uses one portable Core Wasm compiler, Provider4.9, Std1.4.1,
LibSearch0.5.0 and42 current Lib identities. `current/compiler-release.json`
binds the compiler carriers and source build; validate them with
`node scripts/current-compiler-integrity.mjs --require-qualification`.
`catalog/libs-current-v2.json` binds complete current Roots. Its independent
SHA256 is `a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad`. The42 package routes and236 exported API routes form
278 index entries. Search runs the actual compiled Core implementation.
Fourteen native-source rows remain source-only and do not establish executable
Native or device support. Installation grants no Host authority.

Ordinary source supports `u32`, `u64`, signed integer values, documented control
flow, Option/Result and admitted aggregate positions. `u64` preserves width and
signedness. `char` and ordinary async source remain unsupported. A resident/local
Map is not a direct public Map value result. Copy ordered entries only when their
value semantics meet the application contract. Never expose raw handles, private
lanes, Store identities, lifecycle helpers or transfer plans in application source.

The complete73-API Std contract has generated Core and Component Rust SDKs:
[Std1.4.1](standard/wasmc-std/1.4.1/) and
[LibSearch0.5.0](standard/wasmc-lib-search/0.5.0/).
`current/lib_core.wasm` is the matching4.9 Provider. Core and Component
execution are separate profiles. Verify the selected Root's declared imports
and use its manifest-owned SDK paths; do not reconstruct paths or versions.

System Telemetry has a generated Component resource SDK. Its current ordinary
source direct resource-method route remains unsupported. Client Foundation and
Gateway surfaces remain incubating; their presence does not imply production
fleet acceptance or general external-effect exactly-once behavior.

## Execution and Host authority

Use `current/wasmc.mjs` for ESM, `current/wasmc.global.js` for a classic script,
or `current/wasmc_compiler.wasm` for raw Core embedding. Runtime and Registry
carry the same compiler identity. Node, Bun and Deno are independent consumer
hosts. Native `run` uses Wasmi2; explicit Native AOT uses Wasmtime49.0.2.

Compile the smallest complete source, inspect every generated import, compare
module/name/kind/signature with an application-owned exact allowlist, then
instantiate. Pure programs require `imports=[]` and `{}`. A declared import is
an effect request; it grants no filesystem, network, clock, randomness, process,
credential or device authority. Use bounded Host adapters and explicit failure,
cancellation and resource cleanup. Keep native-source, emulator and physical
 device evidence separate.

## Read-only checks

```sh
node scripts/current-compiler-integrity.mjs --require-qualification
node scripts/wasmc-lib.mjs search "base64 decode" --catalog-sha256 a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad --limit 8
node examples/base64/run.mjs
```

Run the oracle for the selected task only. Frozen metadata describes product
capability; successful output is behavior evidence; channel receipts determine
which exact immutable product is released.
