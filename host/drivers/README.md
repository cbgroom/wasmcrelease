# Retained Host domain fixtures

These drivers preserve v0.0.15 behavior, lifecycle tests and cross-platform
oracles while the same domains migrate to Lib-defined system packages.

They are not an extension point. Do not add a new domain here and do not add a
Rust or JavaScript Host API for a new system capability. New domain semantics,
typed APIs and platform mappings belong to exact Lib packages above
`host/contract/lib-defined-boundary.json`.
