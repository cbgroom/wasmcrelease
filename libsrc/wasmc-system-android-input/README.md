# Android input binding Lib

Unreleased Android physical binding for the platform-neutral
`wasmc:system-input@0.0.1` WIT API. The first slice executes Android tap, text
and key-event controls. Command paths and argument lowering remain in the Lib
adapter; the fixed Android Host contains no input operation or key semantics.

Direct Android `/dev/uinput` lowering remains a separate successor gate. This
package is emulator qualification evidence, not admission or release.
