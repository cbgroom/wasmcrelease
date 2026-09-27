# Android UInput binding Lib

Unreleased Android physical binding for the platform-neutral
`wasmc:system-virtual-input@0.0.1` WIT API. The adapter creates a Linux input
keyboard and direct touchscreen through Android's `/dev/uinput`, retains their
descriptors behind generation-checked resource tokens, emits each key batch or
tap with one kernel write and destroys devices explicitly. The same adapter
process also destroys every retained device when its Host session reaches EOF.

The fixed Android Host knows none of the device name, ioctl, event, key or
resource semantics. Persistent Host sessions only transport bounded framed
operations to this exact digest-bound adapter.

Android emulator qualification is not physical-device qualification,
admission or release. WIT-to-Wasm lowering also remains open.
