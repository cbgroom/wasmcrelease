# WAsmC v0.0.31 candidate

This document describes the successor candidate. The candidate is not a formal
release until its source, compiler, full product, publication and download
checks have completed.

The candidate includes a Rust `serde_json`-based JSON Lib with construction of
arrays and objects, ordered atomic edits, selection, and typed Boolean, floating
point and signed/unsigned 64-bit integer reads. Its Core and Component Roots
carry the same JSON implementation. Missing values, JSON null, type errors and
integer range errors remain distinct. The edit API is not a claim of JSON Patch
or JSONPath compatibility; use the shipped WIT for the exact contract.

The candidate removes selected Lib-local byte, count, depth and output quotas
from ordinary compute implementations. Actual memory availability and the
limits of the execution environment still apply. Protocol semantics, checked
overflow, type checks, and explicit caller-provided capacities remain in force.
This statement does not assert that every Lib or every Host route has already
been qualified without a separate limit.

The JSON 0.2.4 candidate has been exercised using its installed Rust 2024 Core
SDK, including repeated calls and ordered edits. Core and Component execution,
ordinary WAsmC use, full-product installation, and formal release checks must
be assessed against the exact final compiler and product, not inferred from a
partial candidate. Existing versioned Roots and earlier releases are retained.

For the released artifact identities and available versions, consult the final
release manifest, current catalog and published checksums. They are not assigned
by this candidate note.
