# WAsmC v0.0.13 system telemetry Lib release

v0.0.13 adds one admitted source-free Lib package:
`libs/wasmc-system-telemetry@0.0.1`.

The compiler, Runtime, Core Runtime SDK, generic Host SDK, Standard Lib and
Data Foundation product bytes are reused from v0.0.12. Existing immutable tags
remain unchanged.

## Admitted telemetry surface

The package exports `wasmc:system-telemetry@0.0.1` as Core and Component
views. Its admitted consumers are:

- source-free Rust Component callers;
- the published Rust `wasmc-host` SDK with explicit generic resources;
- real Linux system acquisition through four read-only proc resources.

The Lib owns parsing, cadence, freshness, transactional state and frame-v3
encoding. It has no telemetry-specific Host API and no ambient filesystem,
process, network or clock authority.

## Explicit non-claims

v0.0.13 does **not** claim:

- direct WAsmC source use of the sampler resource and its rich frame result;
- Browser execution;
- Wasmi Component execution;
- real Windows or macOS system acquisition;
- inheritance of historical telemetry benchmark throughput.

The current published WIT FastABI scalar route is retained as a negative
characterization for the rich result shape; release does not expose raw handles
or add a telemetry Host callback to bypass it.

## Evidence

- 27 native sampler/parser tests plus three bounded resource-read tests;
- source-free Component execution on Ubuntu 24.04, Windows 2025 and macOS 15;
- public Host-SDK fixture/error controls on the same three runners;
- Linux Host-SDK real acquisition with 128 frames, bounded reads and explicit
  release of all four granted resources;
- strict candidate reopen with twelve mutated-package rejection controls;
- cross-platform workflow run `36151207215`.

Telemetry artifact identity:

- Core: `581d6d58c83db4484cb80b5a8492e62125e70600e57b2e26651717dfdd6cdaa1`;
- Component: `1bdbb092414e9e12e0e86a1d10f24490ce10fc37c3656a2653e4e22e20d6d08e`;
- WIT: `c69ccee42113324a2875c352373ddaacb085363480a5f01f32ff919215fd9fe3`.

Admission authority and detailed receipts are under
`admission/system-telemetry-v1/`.

## Promotion

The release follows the existing immutable `dev -> main -> prod` policy.
All three stages must reference one v0.0.13 product candidate and preserve its
product-set SHA-256 exactly. Only suffix-free prod advances the public latest
pointer.
