# Linux endpoint system Lib

Unreleased Linux system Lib prototype. It deliberately reuses Linux VFS and
file-descriptor abstractions instead of introducing Host APIs for individual
devices.

The first physical adapter exposes bounded read/write semantics over endpoint
paths. The same exact adapter is exercised against `/dev/zero`, `/dev/null`,
`/proc/self/stat` and `/sys/devices/system/cpu/online`. Device-specific protocol,
ioctl layout and higher semantics belong in additional Lib layers; the fixed
Native executor only validates and invokes the Lib-owned shared object.

Run `node scripts/test-linux-lib-defined-boundary.mjs` on Linux. This prototype is not
admitted, cataloged or released.
