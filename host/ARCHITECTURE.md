# Host architecture

Status: **Lib-defined boundary workstream / not admitted / not released**.
The immutable v0.0.15 product retains its earlier Host artifacts. The target
architecture and migration plan are defined in
[`docs/HOST_LIB_DEFINED_BOUNDARY.md`](../docs/HOST_LIB_DEFINED_BOUNDARY.md).

## Authority boundary

Exact Lib package WIT owns every public domain API. The matching Lib package
owns the physical native boundary descriptor. The Host contract owns only the
domain-neutral execution mechanisms required to carry that descriptor.

The Rust and JavaScript Host must not acquire file, process, network, service,
protocol, database, device or accelerator APIs when a domain is added. Those
semantics belong to Libs. Existing domain drivers and provider matrices are
v0.0.15 migration evidence, not future extension authority.

The fixed cross-platform invariants are mechanical:

- opaque target and resource identity;
- bounded owned windows;
- operation submission and completion;
- timeout is observation only and is not cancellation;
- cancellation is a request, not proof that an external effect was undone;
- ambiguous admission or a lost authoritative result is `OutcomeUnknown`;
- results are claimed exactly once;
- late completions drain without publishing cancelled output;
- native pointers and physical handles remain inside the boundary executor.

## Layering

```text
WFC / application
        |
        v
portable system and application Libs
        |
        v
platform system Libs + Lib-owned native descriptors
        |
        v
fixed Host contract / core / runtime
        |
        +----------------------+
        |                      |
        v                      v
native boundary executor   embedding boundary executor
        |                      |
        +-----------+----------+
                    v
          OS / native library / service / device
```

`core` and `runtime` implement Resource, Window, Operation and Completion
mechanics. `platform` and `embedding` execute the same domain-neutral physical
boundary. They do not define domain APIs.

## Full-host profile

A full-host WFC is trusted with the host as a whole. This profile does not add
per-domain grant or allowlist APIs. Resource identity remains necessary for
physical lifetime and completion ownership; it is not a catalog of Host-defined
capabilities.

The WFC and its exact Lib graph may construct a Library OS: VFS, process model,
network stack, service manager, scheduler, device model and reconciliation loop
all evolve above the unchanged Host binary.

## Domain growth rule

A new domain normally changes only exact Lib packages:

1. WIT defines the public typed semantics.
2. A platform system Lib defines the native boundary descriptor.
3. Portable Libs construct higher semantics above it.
4. Catalog and LibSearch publish the exact graph.
5. Existing Host bytes execute the new graph unchanged.

A Host mechanism may evolve only after executable evidence from multiple
independent domains proves that the existing boundary cannot express the needed
physical operation. Business-specific operations and platform convenience do
not satisfy that test.

## Native and lightweight execution

Native and embedding paths implement one boundary:

```text
Lib graph -> fixed boundary -> native executor -> OS
Lib graph -> fixed boundary -> Node/Bun/Deno/Browser executor -> environment
```

The surrounding environment may impose different physical availability, but it
does not create a parallel Guest ABI or move domain semantics into Host code.

Each physical target may ship its own fixed implementation of that boundary.
“Fixed Host” therefore means byte-stable within a target and boundary version,
not one native executable shared by Linux, Android, macOS and Windows. The
portable WIT APIs and Lib composition remain uniform; only the Lib-owned
physical binding and target Host implementation vary.

The first Android profile proves this separation on an Android 16 ARM64
emulator. One fixed target Host loads four independent Lib adapters for
standard display, semantic UI, command input and virtual-input APIs. It queries Settings, waits for an
authoritative focused input node, controls the UI, then confirms the effect in
both semantic UI and distinct real frames. The Host itself has zero domain APIs.
The virtual-input Lib additionally creates a real Android `/dev/uinput`
keyboard through a persistent Host session, emits one event batch, rejects a
stale generation after destruction, and recreates the resource without any
Host source or binary change. The same qualification rejects descriptor input
and output overruns, missing exports, and non-sibling adapters. This is emulator
evidence only; WIT-to-Wasm lowering, physical-device qualification, admission
and release remain pending.

## Runtime execution and cache hierarchy

Wasmi and Wasmtime/AOT remain complementary execution lanes. Prepared modules,
persistent AOT bytes and optional Store/Instance pools are caches keyed by exact
artifact plus boundary identity; they are not new domain APIs. An invocation is
never migrated or replayed after an external effect.

## Migration evidence

Existing `host/drivers/*` implementations and
`host/platform/*/providers.json` files remain retained evidence for behavior,
lifecycle and cross-platform oracles. They must not gain new domain rows. File,
process and network are the first migration proof: all three must be supplied by
Lib packages while the Host binary and boundary contract remain byte-identical.

## Packaging

Desktop and mobile packaging may differ, but every package carries the same
boundary identity. Domain availability comes from the installed Lib graph, not
from a compiled Host capability list. A branch, directory or retained fixture
does not prove admission or release.
