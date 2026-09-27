# Host boundary qualification

Target qualification proves that domain growth occurs through Lib packages
while the Host remains unchanged.

Required evidence for a system Lib includes:

- exact Lib/WIT/native-descriptor identity;
- exact Host and boundary identity;
- unchanged Host bytes across independent domain additions;
- real behavior and independent external-state oracles;
- Resource/Window/Operation/Completion ownership and cleanup;
- cancellation, late completion and ambiguous-outcome behavior where relevant;
- Wasmi/Wasmtime and native/embedding scope actually exercised;
- explicit untested platform and physical-layout scope.

The existing platform `providers.json` files are retained v0.0.15 migration
evidence. Their `unimplemented`, `implemented` and `qualified` states remain
historically meaningful but are no longer the future support authority. They
must not gain new domain rows.

`matrix.json` continues to distinguish physical platform × embedding from
browser engine-only evidence. Future reports must identify Lib and descriptor
identities rather than presenting a Host capability matrix.
