# wasmc-data-interchange — public source candidate

This candidate adapts portable Data Core snapshots to and from Arrow IPC file
and Apache Parquet bytes. Arrow and Parquet Rust types remain private.

v0 semantics:

- Arrow IPC uses the file container and preserves encoded batch boundaries;
- Parquet combines exact-schema batches and emits caller-sized decode batches;
- all six Data Core primitive column types are supported;
- encoding requires at least one batch and exact schema equality;
- encode and decode require explicit non-zero byte, batch and row limits;
- the writer rejects output growth before crossing max-output-bytes;
- invalid schema, nullability, type, data and every limit fail closed;
- Parquet v0 writes uncompressed pages for deterministic portability.

This is an internal format Lib, not filesystem or network I/O. Host imports: zero.
