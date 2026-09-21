# Host SDK packaging

`sdk/` is for distribution and developer integration only: package manifests, language bindings, AAR/HAR/XCFramework/npm-style packaging and embedding glue.

Runtime behavior belongs to `runtime/`, capability implementation to `drivers/`/`platform/`, and execution-environment behavior to `embedding/`.

The public Rust embedding facade is `sdk/wasmc-host`. It composes the existing
Core Runtime SDK with generic Resource registration and platform-aware binding
policies; it does not define a second Host ABI.
