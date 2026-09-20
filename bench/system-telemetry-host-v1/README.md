# System telemetry without new Host API — experiment v1

Goal: pressure-test the existing Thin Host mechanism set for high-frequency
system telemetry without adding or editing any guest-visible Host operation.

Hard invariant:

- host/contract/v0/host.wit is unchanged.
- Telemetry is a provider/resource semantic behind existing
  describe/open/read/wait/cancel/release/window-* mechanisms.
- Hot data uses a fixed 64-byte binary frame and bounded ring. No JSON or shell
  parsing exists in the resident path.
- The benchmark separates provider cost from Host transport cost. Synthetic
  production isolates the Host data path; sysinfo 0.39.6 exercises a real
  cross-platform OS-information library.

The first provider selector is system/telemetry. This is experiment-local
provider policy, not a new Host syscall or accepted public namespace.

Run on a development host:

    cargo run --release --locked --manifest-path +      bench/system-telemetry-host-v1/rust/Cargo.toml

Interpretation:

- synthetic@1000Hz asks whether existing resource/window/operation semantics
  can carry a high-frequency bounded stream when the OS sampler is not the
  bottleneck.
- sysinfo@1000Hz is deliberately harsher. sysinfo::MINIMUM_CPU_UPDATE_INTERVAL
  is 200 ms on Linux/macOS/Windows in 0.39.6, so repeated CPU values above 5 Hz
  are expected and are a provider limitation, not evidence for a Host ABI
  addition.
- batch 32 demonstrates amortizing Host crossings without inventing a telemetry
  batch syscall; it is ordinary read into a larger existing Window.
- the shell baseline is a local fork/exec/text-path comparison only, not a
  semantic equivalence claim.

This experiment may justify provider/backend work or optimization of existing
Window/Operation machinery. It does not authorize a new Host primitive.

Additional evidence:

- policy.wasmc is a real resident WAsmC policy with no Host imports. It proves
  that telemetry-derived decisions can stay local and code-driven.
- policy-bench.mjs compiles the policy with the released compiler, instantiates
  it once, and measures hot resident calls.
- evidence/ contains raw macOS/Linux runs plus an existing physical
  HostEndpoint/HostWindow reactor run.

See RESULTS.md for interpretation. In particular, do not read a provider
sampling ceiling as a Host ABI ceiling.
