# Telemetry default build profile

Task state: in-progress. Integration state: not-ready. Future source only.

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

Result so far: default and native-only profiles each pass27/27 unit tests,
zero ignored. Default Wasm42008bytes SHA256
30fd235f2c030f1fbaae39b5248f4495ce99a8731daf6f72f22262ca608a63fe
decodes the unchanged WIT and declares only the exact two canonical resource
intrinsics. Native-only Wasm is rejected by the new read-only artifact checker.
Default metadata resolves34 packages, not the old native-only one-package graph.
Raw telemetry-default-profile-36zS9u/RECEIPT.json SHA256
75ce422a5d08805e80c20fc3afef8672f2874c0afd8443d2944d32df450d1c49.
The initial checker incorrectly assumed a custom-section name and then import
ordering; original failures remain retained. Final gate uses standard WIT decode
and exact duplicate-sensitive import-set comparison, without an order promise.

Resume point: rebind actual default dependency notices to the committed source,
build/reopen the private licensed Root, run the source-free Component lifecycle
consumer, then qualify exact source before integration. Full all18 stays open.
