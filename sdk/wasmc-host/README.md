# wasmc-host

Public Rust embedding SDK for the generic WAsmC Host.

This crate is for existing Rust applications that want to embed WAsmC without
rebuilding runtime setup, resource registration and platform binding policy from
scratch.

The architecture stays generic:

    Rust application
        |
        v
    wasmc-host
        |
        +-- generic Resource / read / write / invoke
        +-- platform detection
        +-- binding policy and auditable BindingReport
        |
        v
    wasmc-core-runtime
        |
        +-- Wasmi immediate path
        +-- Wasmtime optimized path

The SDK does not add telemetry, database, GPU or other application-specific
Host operations. Higher-level capabilities remain Libs over generic resources.

## One-call native setup

    use wasmc_host::{HostBindPolicy, WasmcHost};

    let host = WasmcHost::native(HostBindPolicy::Safe)?;
    println!("{:?}", host.binding_report());

The initial policies are:

- Minimal: runtime only. No resource authority is granted automatically.
- Safe: Minimal plus bounded scratch memory. No ambient filesystem, network,
  credential or device access is granted.
- Development: Safe plus reviewed read-only development resources when the
  target OS already exposes them through generic mechanisms.

On Linux, Development currently binds four ordinary read-only file resources:

- os.proc.stat -> /proc/stat
- os.proc.meminfo -> /proc/meminfo
- os.proc.netdev -> /proc/net/dev
- os.proc.loadavg -> /proc/loadavg

macOS and Windows do not receive a telemetry-specific fallback. Their
Development BindingReport records that explicit generic grants are still
required for system-observation resources.

Automatic binding is best-effort by default and always produces an auditable
BindingReport. Use WasmcHost::native_strict(...) when every resource expected by
the selected platform profile must bind successfully.

## Explicit binding from zero

Profiles are optional. A Rust application may grant exactly the resources it
wants:

    use wasmc_host::WasmcHost;

    let host = WasmcHost::builder()
        .grant_memory("scratch", 1024 * 1024)?
        .grant_file_path(
            "input",
            "/srv/app/input.dat",
            false,
            64 * 1024,
            64 * 1024,
        )?
        .build()?;

Applications may implement ResourceBinding to register another generic resource
without changing the WAsmC Host ABI.

## Runtime configuration

wasmc-host re-exports the public wasmc-core-runtime types. Applications may pass
a CoreRuntimeSdkConfig to WasmcHostBuilder::runtime_config(...) to control
artifact limits, compilation queue limits and runtime resource limits.

## Release consumption

The SDK is distributed in the same public wasmcrelease repository and immutable
release identity as the compiler/runtime artifacts.

For a checked-out release:

    wasmc-host = { path = "sdk/wasmc-host" }

For Git consumption, pin the same immutable wasmcrelease tag or full commit that
contains the SDK:

    wasmc-host = {
      git = "https://github.com/cbgroom/wasmcrelease.git",
      rev = "<immutable-release-commit>"
    }

Do not depend on mutable main for production.

## Current scope

This first SDK milestone packages synchronous generic resource registration and
the existing Core Runtime SDK. Formal generated WAsmC resource/window/read/write
bindings are still owned by the separate generic Host I/O workstream. The Rust
SDK intentionally does not special-case a higher-level Lib to bypass that gate.
