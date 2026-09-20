# wasmc-csv — public source candidate

CSV ingestion is a pure Lib concern. This candidate has zero Host imports and
uses Apache Arrow's Rust CSV reader directly.

The caller supplies the schema explicitly. This avoids making schema inference
policy part of the stable CSV ABI and keeps data shape flexible. Parsed output
uses `wasmc:data-core/model@0.0.1#batch-snapshot`.

The implementation batches rows instead of exposing row callbacks. Header
validation is optional and delegated to Arrow CSV.

Binary columns are intentionally not accepted by CSV v0; the Data Core model
supports binary, but CSV has no universal binary textual representation.
