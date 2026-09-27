# Linux endpoint system Lib

Unreleased Linux system Lib prototype. It deliberately reuses Linux VFS and
file-descriptor abstractions instead of introducing Host APIs for individual
devices.

The physical adapter exposes both one-shot bounded read/write and persistent,
generation-checked endpoint resources. A persistent endpoint supports read,
write, `poll` and a raw Linux `ioctl` transport. Device-specific request numbers,
buffer layouts and higher semantics belong in additional Lib layers; the fixed
Native executor only validates and invokes the Lib-owned shared object.

The same exact adapter is exercised against `/dev/zero`, `/dev/null`,
`/dev/ptmx`, `/proc/self/stat` and `/sys/devices/system/cpu/online`. The
`/dev/ptmx` proof performs a real `TIOCGPTN` ioctl. The executor session keeps
the adapter loaded and reuses its output window, while the Lib owns FD lifetime
and rejects stale generation tokens. This is the first high-throughput path;
native async completion and mapped windows remain separate future gates.

Run `node scripts/test-linux-lib-defined-boundary.mjs` on Linux. This prototype is not
admitted, cataloged or released.
