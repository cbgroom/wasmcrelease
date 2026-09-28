# `wasmc:http1-client@0.0.1`

Portable HTTP/1.1 client wire semantics above transport and TLS Libs. This
candidate serializes bounded requests and incrementally decodes fixed-length,
chunked, bodyless and connection-close-delimited responses. It rejects common
ambiguous framing and request-smuggling shapes.

The Core Wasm has zero imports. It does not open sockets, resolve DNS, validate
certificates or choose retry/redirect policy. A complete HTTPS client composes:

```text
wasmc-http1-client -> client TLS Lib -> platform transport Lib -> fixed Host
```

Current lifecycle: qualified public-source candidate; not admitted, released,
discoverable or installable. HTTP/2, redirects, decompression, cookies,
authentication, public-root TLS and end-to-end HTTPS qualification remain
separate gates.
