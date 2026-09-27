# Android UInput binding Lib

Unreleased Android physical binding for the platform-neutral
`wasmc:system-virtual-input@0.0.1` WIT API. The adapter creates a Linux input
device through Android's `/dev/uinput`, retains its descriptor behind a
generation-checked resource token, emits key batches with one kernel write and
destroys the device explicitly.

The fixed Android Host knows none of the device name, ioctl, event, key or
resource semantics. Persistent Host sessions only transport bounded framed
operations to this exact digest-bound adapter.

Android emulator qualification is not physical-device qualification,
admission or release. WIT-to-Wasm lowering also remains open.
