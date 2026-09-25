#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
package="${1:-$root/admission/system-telemetry-v1/package}"
package="$(cd "$package" && pwd)"
node "$root/scripts/test-telemetry-package.mjs" "$package"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/wasmc-telemetry-consumer.XXXXXX")"
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/consumer/wit"
cp "$root/examples/system-telemetry/component_consumer.rs" "$scratch/component_consumer.rs"
cp "$root/examples/system-telemetry/consumer/Cargo.toml" "$scratch/consumer/Cargo.toml"
cp "$root/examples/system-telemetry/consumer/Cargo.lock" "$scratch/consumer/Cargo.lock"
cp "$package/lib.wit" "$scratch/consumer/wit/world.wit"
# No Lib implementation is copied or declared as a Cargo dependency.
cargo build --release --locked --manifest-path "$scratch/consumer/Cargo.toml" --target-dir "$scratch/target"
binary="$scratch/target/release/telemetry-consumer"
if [[ -f "$binary.exe" ]]; then binary="$binary.exe"; fi
"$binary" "$package/component.wasm"
