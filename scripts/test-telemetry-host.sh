#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
package="${1:-$root/admission/system-telemetry-v1/package}"
package="$(cd "$package" && pwd)"
node "$root/scripts/test-telemetry-package.mjs" "$package"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/wasmc-telemetry-host.XXXXXX")"
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/public/examples/system-telemetry/host-consumer/wit" "$scratch/public/sdk" "$scratch/public/host/drivers/file" "$scratch/public/host/drivers/memory"
tar -C "$root" --exclude=target --exclude=.DS_Store -cf - \
  sdk/wasmc-host sdk/wasmc-core-runtime host/drivers/file/rust host/drivers/memory/rust \
  | tar -C "$scratch/public" -xf -
cp "$root/examples/system-telemetry/host_consumer.rs" "$root/examples/system-telemetry/resource_snapshot.rs" "$scratch/public/examples/system-telemetry/"
cp "$root/examples/system-telemetry/host-consumer/"Cargo.{toml,lock} "$scratch/public/examples/system-telemetry/host-consumer/"
cp "$package/lib.wit" "$scratch/public/examples/system-telemetry/host-consumer/wit/world.wit"
# Only public SDK/driver glue, consumer source and exact WIT are present.
# No telemetry implementation, private compiler source, or rebuilt Lib.
test ! -e "$scratch/public/libsrc"
export CARGO_TARGET_DIR="${WASMC_TELEMETRY_HOST_TARGET:-$scratch/target}"
export WASMC_TELEMETRY_COMPONENT="$package/component.wasm"
manifest="$scratch/public/examples/system-telemetry/host-consumer/Cargo.toml"
cargo test --release --locked --manifest-path "$manifest" -- --test-threads=1
cargo build --release --locked --manifest-path "$manifest"
binary="$CARGO_TARGET_DIR/release/telemetry-host-consumer"
if [[ -f "$binary.exe" ]]; then binary="$binary.exe"; fi
case "$(uname -s)" in
  Linux) "$binary" "$package/component.wasm" ;;
  *) echo 'Portable SDK read controls passed; live Linux acquisition not attempted on this platform.' ;;
esac
