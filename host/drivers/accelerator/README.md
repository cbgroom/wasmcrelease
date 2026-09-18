# Shared accelerator substrate model

GPU and NPU remain distinct typed semantic capabilities. They share one
device-neutral accelerator lifecycle substrate instead of duplicating kernel
resource, operation, completion, cancellation or retirement semantics.

The machine-readable contract is `model.json`. It changes no platform support
state and does not implement a GPU or NPU provider.

## Shared substrate

- one admitted submission maps to one Host Operation and one terminal Completion;
- cancellation is request-only;
- ambiguous post-admission loss settles to terminal outcome-unknown and is never replayed;
- dropping Guest observation transfers supervision to the Host rather than cancelling work;
- physical retirement waits for authoritative settlement;
- drain remains an explicit typed physical operation rather than a generic release side effect;
- 1–16 bounded window slices describe command/input/output buffers;
- completion reports aggregate transferred bytes only, not one result per buffer;
- vendor handles, queue pointers, device addresses and native buffer pointers never become Guest authority.

The structural fixture uses one 4 KiB command segment plus two 4 MiB tensor
segments. It exists only to prove that the shared bounded-vector lane can express
multi-buffer accelerator submissions without changing the frozen lifecycle.

## Typed capability boundary

`gpu` and `npu` remain separate capabilities because their operation schemas,
feature negotiation and provider policies can evolve independently. Both lower
to this shared substrate for lifecycle and bounded buffer transport.

Platform providers own device discovery, queue/context creation, native buffer
binding and vendor-specific execution. No platform is marked implemented or
qualified by this semantic model.
