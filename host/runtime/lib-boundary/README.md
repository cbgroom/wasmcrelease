# Fixed Lib-defined boundary reference

This unreleased JavaScript reference implements only opaque resources, bounded
windows, operations, completions, cancellation and exact Lib adapter loading.
It contains no file, process, network or device API.

An exact Lib package supplies `native-boundary.json` and a digest-bound adapter.
The adapter is part of that Lib's physical binding, not a Host extension. The
reference snapshots input, pins its window until physical completion, suppresses
cancelled delivery, allows one completion claim and requires explicit release.

Run `node scripts/test-lib-defined-boundary-runtime.mjs` for three real-domain
probes using one byte-identical executor. The proof is local Node behavior only;
it is not admission, a native Rust implementation, Component lowering or a
cross-platform release.
