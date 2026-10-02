# Telemetry default build profile

Task state: started. Integration state: not-ready. Future source only.

Objective: default reviewed telemetry source must expose its declared standard
WIT Component API; preserve an explicit native-only opt-out.

Technical basis: exact public source bbf13a1 retains default=[] while the adapter
is cfg(feature="component"). Private current producer's isolated build fails
Component encoding with no decodable world after API ordering is normalized.
Failure receipt SHA256 22818a38b93c8c59c9d2891967ad39bc4fffe9a12f18860d44d0ecdf0896673f.

Plan: set default=["component"], document --no-default-features, add a prebuilt
artifact checker; build only in private qualification output, audit the actual
enabled dependency graph/notices, and verify unchanged WIT/lifecycle behavior.

Boundaries: no private compiler disclosure, Host API change, old Root mutation,
release/catalog migration or Telemetry0.0.2 admission claim. Keep failed receipts.
Do not refresh frozen0.0.20 identity around future source. Current full public
orientation fails the existing lib-catalog manifest mismatch; focused gates and
old-candidate drift rejection are required under the pre-candidate exception.

Validation: offline locked default and no-default native tests; default wasm
build/strict licensed Root reopen; prebuilt artifact WIT/import/export checks;
source-free Wasmtime constructor/sample/drop consumer; actual default metadata
and retained original notices; focused license/route gates; git diff --check.

Cache: existing shared consumer pool only, one writer;12GiB/80percent,100GiB
free floor,0.5GiB growth. No cold cache removal or new heavyweight target.

Resume point: after this START is pushed, implement only the three claimed
product paths and execute private producer gates. Full all18 closure stays open.
