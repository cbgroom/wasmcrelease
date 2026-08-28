# Author a Lib

Start from reviewed WIT, not Rust source discovery. Reuse the source ecosystem's
names and semantics whenever possible, then declare only the delta an Agent
must learn.

For every exported API record:

- its WIT name and source ecosystem;
- `exact`, `adapted`, or `wasmc-specific` origin;
- `supported` or `unsupported` status;
- `core`, `lib`, or `host` implementation placement;
- explicit delta for adapted, wasmc-specific, or unsupported APIs;
- exact Host authority when placement is `host`.

An exact supported API has no delta prose. Artifact tiers (64, 128, 256, 512,
or 1024 KiB) are deployment metadata and never create Agent-visible language
dialects.

## Tool boundary

The first `wasmc lib tool` artifact is an import-free wasmc-written Core Wasm
kernel. It validates normalized API/package classifications, reports its own
capabilities, and selects the smallest artifact tier. A separate wasmc-written
descriptor layer consumes one bounded WIT API name through an explicit scalar
workspace port and emits a deterministic Agent-delta JSON row. A third
wasmc-written layer consumes 1..64 indexed rows, rejects invalid, duplicate, or
unsorted WIT names, malformed UTF-8, policy/delta mismatch, and invalid Host
authority identifiers before starting output. It owns deterministic JSON
escaping and emits the complete `wasmc.lib-agent-delta/v0` document with
ecosystem, conditional delta text, and exact Host authorities. All three are standard Core Wasm; the
policy kernel runs unchanged with JavaScript `WebAssembly` and Rust/Wasmtime,
while both workspace adapters have in-memory JavaScript Host proofs. The
complete document artifact is also bound by the public Rust workspace Host,
which exposes in-memory generation under Wasmtime.

After the same complete preflight, the document tool emits one package-specific
root `SKILL.md`. A Lib is itself a Skill package; it does not contain a second
`skills/` tree or its own `AGENTS.md`. The Skill routes an Agent to root
`lib.wit` and `references/agent-delta.json`; per-API knowledge is not copied
into Markdown.

The final package shape is:

```text
<lib-name>/
  SKILL.md
  lib.wit
  lib.json
  artifact.wasm
  component.wasm
  references/
    agent-delta.json
```

An installer may place that directory under `.agents/skills/<lib-name>`, but
the installation prefix is not part of the Lib format. `SKILL.md` is Agent
discovery and usage guidance, WIT is semantic authority, `lib.json` is machine
identity/version/digests, and the reference contains only declared ecosystem
delta.

`artifact.wasm` is the same-domain Core fast path. Adapter-built packages also
contain `component.wasm`, the standard WIT/Canonical ABI boundary for callers
in other languages. Agents program against `lib.wit`; they do not write Core
pointer/length lanes or select between these artifacts in source.

For a caller-pinned typed-resource Lib whose public identity is a WIT resource,
native tooling can call `wasmc::componentize_typed_resource_lib` with the exact
plan bytes, Lib Core bytes, interface name, and bounded identity capacity. The
plan—not a second handwritten Component function table—selects Core exports,
receiver borrow/consume ownership, declared success status, rollback, and the
private drop binding. Private `i64` status bindings carry resource identity,
ownership, rollback, and drop. A plan row selecting `canonical-abi-v0` carries
recursive WIT values through the Lib's own exported standard `memory` and
`cabi_realloc`; the same Component generator recursively admits scalar,
String, List, record, Option, Result, and variant parameters/results. WIT has
no native Map, so publish an explicit `list<Entry<K,V>>` snapshot. Agents use
the WIT types and never write pointer/length lanes, choose adapter memory, or
relabel a private reference as a value. Nested resources and ambiguous
non-receiver resource ownership fail closed.

For a managed Lib implementation, the compiler may compose a private snapshot
caller that exposes a dense type-ordinal lookup to its generated adapter. This
is not an API agents call and not runtime reflection: the exact Lib plan owns
the ordinals and Canonical layout, while public code continues to see only
ordinary WIT types. Records, nested `option<T>` and `result<T,E>`, strings, and
lists therefore keep their normal WIT spelling; the compiler selects the
active sum arm, copies owned payloads, and releases the private root. Keep a
resident `map<K,V>` as Map in application code and same-domain Lib calls. When
the WIT contract explicitly needs a copied map snapshot, declare a record such
as `Entry { key: K, value: V }` and return `list<Entry>`; direct public Map is
rejected instead of being silently serialized. Neither Agents nor application
authors select Provider cleanup functions, private handles, or type ordinals.

The current workspace source stage accepts package-specific Skill metadata,
reviewed `lib.wit`, and normalized rows, validates WIT, and generates the three
source-package files in memory. The separate local Rust `rust-build` Host can
now take a reviewed crate that already exports a compatible standard Core ABI,
run a fixed locked/offline Cargo release build for `wasm32-unknown-unknown`, add
`artifact.wasm`, the WIT-derived `component.wasm`, and strict digest-bound
`lib.json`, and atomically publish the
complete previously absent package. It is pinned to explicit workspace and
publication roots, uses a private target directory, and never overwrites or
merges a destination.

For a reviewed Rust crate that does not already expose Core ABI functions, the
explicit adapter stage accepts one data-only row per exported WIT function:
WIT interface, WIT function, and safe Rust path segments below one named local
dependency. WIT determines parameter/result types and the exact Core export
name; the mapping cannot contain Rust expressions. The first profile supports
synchronous free functions whose inputs are bool or numeric scalars, owned
`string`, `list<scalar>`, or explicitly mapped flat WIT records composed from
those types. Results support the same family plus one WIT-owned `option<T>`,
`result<T,E>`, or named `variant` layer whose payloads use those admitted
leaves. A named variant adds an explicit complete case mapping because WIT
case names and Rust enum variant identifiers are distinct tooling facts.
Multi-lane results use the
standard Canonical ABI result pointer and deterministic
`cabi_post_<wit-function>` cleanup; direct Core callers terminate that result,
while Component callers receive ordinary owned WIT values. It rejects missing,
duplicate, unknown, or unsupported rows before publication, generates an
invocation-private adapter crate, and uses the same strict builder.

For resource-oriented or Host-backed Rust, use the same command with the
standard `wit-bindgen-component` profile. The selected crate is an ordinary
`wit-bindgen` guest implementing the exact `lib.wit`; this preserves familiar
Rust/WIT conventions for resources, constructors, receiver methods, values,
fallibility, and explicit imports. The builder removes the crate's embedded
metadata and re-embeds the package `lib.wit`, so stale or different bindings
fail during Component construction. Every WIT import requires a matching Host
implementation row with explicit authority. Async WIT is rejected.

This is not arbitrary crate conversion. The author still supplies reviewed WIT,
normalized delta rows, crate selection, and exact Rust paths. The tool does not
discover Rust APIs or infer semantics. Sum inputs and nested sum layers remain
outside the compact mapped adapter; async, traits, and open generics remain
outside both profiles. WIT has no native map, so this transport does not invent
one: use explicit `list<Entry>` values or a declared resource. Cargo
`--offline` is not a `build.rs` sandbox. The source-private
Python wrapper is neither a public dependency nor semantic authority.

The public local entrypoint for that reviewed profile is now:

```sh
wasmc lib build \
  --workspace <workspace-directory> \
  --publication <output-directory> \
  <directory-containing-lib.wit>/lib.build.json
```

Start with `examples/wasmc_lib_candidate_v0` for scalar-only APIs or
`examples/wasmc_lib_dual_view_candidate_v0` for owned String, scalar-list, and
flat-record inputs, or `examples/wasmc_lib_dynamic_result_candidate_v0` for the
same owned value family in results. Use
`examples/wasmc_lib_sum_result_candidate_v0` for Option, Result, and named
variant results with dynamic payloads. Use
`examples/wasmc_lib_resource_candidate_v0` for constructors and receiver
methods, or `examples/wasmc_lib_host_candidate_v0` for an explicit Host-backed
guest. Edit `lib.wit` first, then
record Skill identity, normalized Agent delta rows, the reviewed crate, and one
explicit mapping per WIT function in `lib.build.json`. The JSON is strict
tooling data, not API authority. Success prints a deterministic receipt and
publishes one previously absent package; it never overwrites. See
`docs/wasmc-lib-build-command-v0.md` for the exact v0 boundary.

The intended finished flow is:

```text
reviewed WIT + explicit Agent delta
  -> wasmc-written inspect / describe / verify
  -> explicit rust-build Host port (local Cargo or remote builder)
  -> root Skill package: SKILL.md + lib.wit + lib.json
     + artifact.wasm + component.wasm
     + references/agent-delta.json
```

Cargo, filesystem, cache, remote builder, and publication are Host authority.
The tool must remain runnable in a browser when those ports are supplied; it
must never embed rustc or silently infer semantic compatibility from a crate
name or comments.
