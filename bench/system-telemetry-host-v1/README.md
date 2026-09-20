# System telemetry as a Lib over generic Host resources

Goal: prove that high-frequency system telemetry can be implemented as a Lib
that depends only on the existing generic Host Resource/Window/Operation ABI.
Telemetry must not become a Host capability family or a telemetry-specific
provider abstraction.

Hard invariant:

- host/contract/v0/host.wit is unchanged.
- Host Core contains no telemetry API, telemetry opcode or telemetry schema.
- There is no TelemetryProvider/TelemetryBackend abstraction.
- The trusted embedding cold path registers ordinary preopened resources.
  The Linux harness uses four ordinary file resources corresponding to
  /proc/stat, /proc/meminfo, /proc/net/dev and /proc/loadavg.
- TelemetryLib receives only opaque resource identities and performs generic
  reads. Parsing, cadence, freshness and TelemetryFrame are Lib concerns.
- Hot data uses a fixed 64-byte binary frame and bounded ring. No JSON or shell
  parsing exists in the resident path.
- frame-schema-v2.json freezes the 64-byte layout. Each frame includes a
  freshness bitset so a 1 kHz frame cadence never pretends that every OS field
  was physically re-sampled at 1 kHz.
- Frame v2 intentionally carries no platform/provider/backend identity.
- sequence makes bounded-ring overwrite observable. Overload may discard old
  frames, but it must never become silent data loss.
- The benchmark separates generic resource-read cost from Lib parsing and
  cadence cost.

The selectors os.proc.stat, os.proc.meminfo, os.proc.netdev and os.proc.loadavg
are trusted namespace data. GenericResourceHost does not interpret those names.

Run on a development host:

    cargo run --release --locked --manifest-path \
      bench/system-telemetry-host-v1/rust/Cargo.toml

Linux generic-resource-only qualification:

    cargo run --release --locked --manifest-path \
      bench/system-telemetry-host-v1/rust/Cargo.toml -- \
      --generic-resource-only

Interpretation:

- generic-resource-lib-burst measures the maximum Linux Lib sampling path over
  opaque generic file resources.
- fast keeps CPU/network external-resource reads on every frame.
- balanced keeps a 1 kHz Lib frame clock while reducing CPU/network/memory
  resource reads to roughly 100 Hz and load to roughly 10 Hz.
- economy keeps the same 1 kHz frame clock while reducing external-resource
  reads further.
- the shell baseline is a local fork/exec/text-path comparison only, not a
  semantic equivalence claim.
- legacy direct/sysinfo paths remain controls only; they are not the target
  architecture.

This experiment can justify Lib or generic Host implementation optimization.
It does not authorize a telemetry-specific Host primitive.

Additional evidence:

- policy.wasmc is a real resident WAsmC policy with no Host imports. It proves
  that telemetry-derived decisions can stay local and code-driven.
- policy-bench.mjs compiles the policy with the released compiler, instantiates
  it once, and measures hot resident calls.
- evidence/ contains raw macOS/Linux runs plus an existing physical
  HostEndpoint/HostWindow reactor run.

See RESULTS.md for interpretation. In particular, do not read an external
resource sampling ceiling as a Host ABI ceiling.
