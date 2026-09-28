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

The exact Linux System socket provider, Linux/Windows platform root providers,
iOS and Android compositions remain pending.

Current lifecycle: qualified public-source candidate; not admitted, released,
production-discoverable or installable.
