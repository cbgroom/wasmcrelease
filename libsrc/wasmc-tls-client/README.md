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
name and decodes the returned HTTP response. The exact Linux System socket
provider, public-CA root bundle, iOS and Android compositions remain pending.

Current lifecycle: qualified public-source candidate; not admitted, released,
production-discoverable or installable.
