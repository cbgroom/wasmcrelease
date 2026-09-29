# WAsmC v0.0.16 Dynamic Client/Gateway release

v0.0.16 is a source-free higher-layer runtime update. It reuses the v0.0.15
compiler, CoreLib, SDK and fourteen formal Lib package roots without rebuilding
or replacing their bytes.

The new product surface consists of:

- `runtime/client-foundation-v1`, the persistent Client runtime above the fixed
  Lib-defined Host boundary;
- `runtime/client-foundation-gateway-v1`, the matching WSS control and HTTPS
  content-addressed artifact service;
- canonical serial and general-DAG Lib graph identities derived from exact
  package, WIT, port, configuration and state contracts;
- atomic generation publication, unchanged-block reuse, rollback and durable
  retired-generation cleanup;
- Gateway and Client restart reconstruction, active `snapshot-v1` checkpoint
  restore and crash-after-joint-write receipt recovery without replay;
- exact cross-schema state migration through an ephemeral content-addressed
  migration Lib;
- sticky-state fail-closed or explicit reset-on-restart disposition;
- immutable factory rescue when a committed mutable provider is unavailable.

The surface is `incubating`, not a formal Lib package. It is absent from the Lib
catalog and does not gain admission, discovery or installation state. The fixed
Host API and minimal compiler CLI are unchanged.

The release does not claim general exactly-once external effects, external
effect rollback, clustered Gateway consensus, fleet scheduling, public service
deployment, cache-retention policy or mobile/physical-device qualification.
Those remain deployment- or provider-owned work.

`runtime/client-foundation-v1/release-surface.json` is the bounded product
authority. `release.json` remains the lifecycle authority, and the immutable
candidate under `channels/candidates/0.0.16.json` binds the exact product files.

Promotion follows the unchanged dev → main → prod contract. Every stage must
preserve the same product-set digest. The final suffix-free prod tree requires
the exact two-model Pi pre-release gate and independent white-box acceptance
before tagging or pushing.
