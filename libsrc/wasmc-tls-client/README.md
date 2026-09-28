# `wasmc:tls-client@0.0.1`

Portable TLS client semantics derived from the already-qualified
`wasmc:tls-core` server state-machine shape. It reuses the same pinned rustls
and RustCrypto provider, the exact `wasmc:tls-core/entropy@0.0.1` import, bounded
buffers, partial-output commit protocol, plaintext read/write and close
lifecycle.

The client-specific constructor accepts the server name, DER trust roots,
trusted Unix time and ALPN protocols. Time and roots are explicit data so this
Lib adds neither a clock nor certificate-store API to the fixed Host. A higher
Lib or platform provider supplies those values.

This package does not open sockets or resolve DNS. HTTPS composes it with
`wasmc:http1-client@0.0.1` and a platform transport Lib.

The retained candidate qualification performs that HTTP/TLS composition over
a real OS loopback TCP stream, negotiates `http/1.1`, rejects a wrong server
name and decodes the returned HTTP response. Wasmi 2.0.0 also executes the
candidate Core with an exact entropy allowlist and exercises construction,
ClientHello output/commit and resource destruction. A separate macOS
qualification passes all 158 SystemRootCertificates as ordinary Lib data and
performs a certificate-validated public HTTPS request. The root boundary is
therefore 256 certificates rather than the earlier synthetic limit of 64.

The canonical-build qualification builds twice in independent target
directories and requires byte identity before publishing one exact artifact to
the hosted matrix. Every macOS, Linux and Windows job executes that same file;
the matrix does not substitute a platform-local rebuild. This distinction is
intentional: stable Rust retains absolute Cargo and toolchain panic-location
paths, so source rebuild hashes can differ between build hosts even though the
Wasm target and behavior are the same. `artifact_observation` is consequently
a same-environment observation, not a claim of cross-host build identity.

On Linux aarch64, a separate composition drives the same TLS Core through the
digest-bound `wasmc:system-linux-socket@0.0.1-dev.1` adapter and unchanged fixed
executor for every handshake and HTTP byte. Linux x86_64 remains an independent
architecture gate. Linux/Windows platform root providers plus iOS and Android
compositions also remain pending.

Current lifecycle: qualified public-source candidate; not admitted, released,
production-discoverable or installable.
