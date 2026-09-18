# Platform adapters

This is the only canonical home for OS/device-specific Host implementation.

Each platform implements the same capability model. Missing features are
reported as unavailable capabilities/resources; they do not create new
guest-visible Host APIs.

Platform binding manifests are stored in `providers.json`. Shared provider
code is preferred when a stable native abstraction already supplies equivalent
semantics across operating systems. See `PROVIDER_MODEL.md`.
