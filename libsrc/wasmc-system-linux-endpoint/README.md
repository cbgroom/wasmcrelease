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
and rejects stale generation tokens. The next profile adds generation-checked
`mmap` regions with bounded read/write, `msync`, explicit unmap, out-of-bounds
rejection and stale-mapping rejection.

The mapped-region proof uses a real `/dev/zero` mapping. It establishes device
mapping and lifetime in the Lib, but the current byte ABI still copies between
the mapped region and the executor window. Direct guest/shared-window zero-copy
and native async completion remain separate future gates.

The Lib also owns a generation-checked `epoll` event-set resource. Qualification
opens a real PTY master through `/dev/ptmx`, unlocks and opens its `/dev/pts/N`
slave, registers the master, writes through the slave, observes and reads the
master readiness event, removes it, and rejects the event-set token after close.
No `epoll` or PTY branch exists in the fixed Rust executor. This proves
Lib-defined readiness aggregation; it is still a synchronous wait in the
persistent session, not native asynchronous completion or cancellation.

For device-to-device data movement, the Lib owns generation-checked `pipe2`
endpoints and Linux `splice`. Qualification moves bytes through the real path
`/dev/zero -> pipe -> /dev/null` without carrying payload bytes through the
fixed Rust executor window, then rejects a stale pipe token. This is a genuine
kernel splice path, but it is not yet direct guest/shared-window zero-copy.

The Lib now has a generation-checked asynchronous readiness operation. It
retains a duplicated endpoint descriptor, performs native readiness work outside
the executor call, and exposes pending, ready, cancelled, timed-out and failed
states. Qualification proves real PTY readiness, cancellation, timeout,
premature-release rejection, terminal re-cancel rejection, stale-operation
rejection, cancellation-priority over late readiness, 64 concurrent operations
and safe cancellation after the originating endpoint token is closed.
The current prototype uses one native worker per operation as a lifecycle
baseline. It is not the future high-throughput `io_uring` backend and is not yet
bridged into the Host's generic Completion/late-delivery model.

Run `node scripts/test-linux-lib-defined-boundary.mjs` on Linux. This prototype is not
admitted, cataloged or released.
