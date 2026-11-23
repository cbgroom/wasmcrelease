# Exact current Lib selection

The v0.0.31 current catalog is `libs-current-v2.json`, schema
`wasmc.public-lib-catalog/v2`. Its independently reviewed SHA256 is
`ac32312f3e06f7ca2b3f8e20d66ecd4914f1ffd10ad45ae1cef4ff06a9628192`. It binds 43 complete current Roots and their 289 WIT API routes, forming 332 index entries.
The package artifact authority is immutable public commit
`f0166ba76b8613f6decd1ab7c362ca8a9cd90031`.

```sh
node scripts/wasmc-lib.mjs search "base64 decode" --catalog-sha256 ac32312f3e06f7ca2b3f8e20d66ecd4914f1ffd10ad45ae1cef4ff06a9628192 --limit 8
node scripts/wasmc-lib.mjs resolve wasmc-std 1.5.2 --catalog-sha256 ac32312f3e06f7ca2b3f8e20d66ecd4914f1ffd10ad45ae1cef4ff06a9628192 --manifest-sha256 229df2e763411febc2f3fd275666265833a53f6f9f3c03e44b9d6b0cd9411338 --root-inventory-sha256 86ea6bc3c5f7f49b3656e79cd1db9c23440235b673f0595309d05375556fea1d
```

Search executes the compiled Core implementation. The JSON overlay response uses
`result.tag` and `result.value`. Hits contain package_id, version, profile,
source_path, wit_route and delivery pins. Read the selected row's Root, then
its pinned Skill, WIT, manifest and declared SDK views.

`resolve` emits an exact `wasmc.public-lib-lock/v2` only after verifying the
catalog, manifest and complete Root inventory. It performs no semver selection
and grants neither engine admission nor Host authority. [Install](INSTALL.md)
with a separately approved lock digest and explicit mirror. Seventeen native-source
Roots remain source-only. Their bytes can be installed without establishing
Native execution or device acceptance. Older catalogs belong to their exact
immutable artifacts and are not the default current tooling route.
