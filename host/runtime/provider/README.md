# Host provider selection

Provider selection is an internal runtime mechanism between canonical drivers and a concrete platform or embedding implementation.

A provider may be backed by:

- a native platform adapter (`platform/*`), or
- an execution environment (`embedding/*`).

Provider identity is never guest-visible. The guest receives only opaque Resources admitted through the canonical Host contract.

Hot-path dispatch remains Resource + Operation oriented; platform/embedding discovery and provider selection are cold-path concerns.
