# Canonical Host conformance fixture

This fixture preserves the original HTTP/Table contracts, ordinary WAsmC source,
source-bound activation and JSON0.0.5 producer auxiliaries used by the Native
qualification. The complete immutable Root is in
`standard/wasmc-json/0.0.5/`; its catalog admission is a separate release step.

The generic SDK has no HTTP, Table, JSON, package-name or source-hash dispatch.
These contracts are caller inputs. The test compares compiler outputs with the
recorded Native frame and performs no filesystem/database/network application
operation. Actual platform build/install/new external input acceptance belongs
to the platform owner.
