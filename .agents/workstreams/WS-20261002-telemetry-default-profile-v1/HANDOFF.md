# Telemetry default build profile

Task state: completed. Integration state: merged. Future source only.

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

Exact source qualified:2aab14f07545919089f5a0360fc9cb9624e8217f.
Fresh default/native-only tests27/27 each and artifact/control checks PASS;
receipt SHA2568f80194f811cce20f8ec6ee8960dfdb8f0056a5c4bb91440c9c93ff6819d0c77.
Default notices33 registry dependencies,74 original texts,4 bundles473138bytes;
source-bound preparation SHA256
cac2c76c7df2d47ba8b66e823780ad582cb9cff52b15fff6f082c6ec50cde7ea;
independent byte/dependency check SHA256
c84879604e11e638848b3afa5746dd772943d965e13d15a0c42e47c3276e21e9.

Private licensed diagnostic Root build + strict reopen PASS; receipt SHA256
cbf166b162e14c75673a6ad5d9ca938215bc141999827ad101c6012f43d32043.
Core41905bytes SHA256
48dc6ec19c840c01636e43017df610ceee9a7a6f4b8d5014c56aec2e56b64182;
Component44991bytes SHA256
1d47accaa5121d5b20424fcf17d55dc466fb2a4ca261f6cb571226f406760e1d.
Independent complete package pin/readback and Wasmtime49 source-free consumer:
128 rounds constructor/sample/cache/transactional missing-input recovery/frame/
clock-regression/drop/double-drop PASS, zero OS Host bindings. Core imports are
the exact two canonical sampler resource intrinsics, not zero imports.
Lifecycle receipt SHA256
d56f3d370487f6dd290faee70f7b909e39d0d86b3fdb07caf5faf8f3ed726afe.
Consumer copies only public WIT/reference/Cargo inputs, no implementation.
Pool growth81850368bytes, within declared0.5GiB growth. Failed zero-import
assumption and caller WIT-location attempts remain retained, not hidden.

Focused gates: future-license18targets/18negative controls, notice15negative
controls, license policy6Cargo/2frozen PASS. Old0.0.20 rejects product drift.
Resume: integrate source only with global handoff, then repeat integration
qualification. No new public Root/version/candidate/admission. Wasmi, cold
determinism, SDK and ordinary sampler caller remain separate all18 gates.
