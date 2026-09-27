# Portable Host core

Only platform-independent boundary mechanism belongs here: opaque identity,
window ownership, operation/completion lifecycle and deterministic cleanup.
Namespace, protocol, framing, platform normalization and remote semantics belong
to exact Lib packages.
