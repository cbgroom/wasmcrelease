# Exact current Lib selection

The v0.0.24 current catalog is `libs-current-v2.json`, schema
`wasmc.public-lib-catalog/v2`. Its independently reviewed SHA256 is
`0a3eaa87733eb32c69379cff4f8c79079c49045787999396a9e2730ebf13d90a`. It binds42 complete current Roots and their247 WIT API routes, forming289 index entries.
The package artifact authority is immutable public commit
`0e91db5e63ab5750cb621add5ad48a5581aedfa1`.

```sh
node scripts/wasmc-lib.mjs search "base64 decode" --catalog-sha256 0a3eaa87733eb32c69379cff4f8c79079c49045787999396a9e2730ebf13d90a --limit 8
node scripts/wasmc-lib.mjs resolve wasmc-std 1.4.1 --catalog-sha256 0a3eaa87733eb32c69379cff4f8c79079c49045787999396a9e2730ebf13d90a --manifest-sha256 9db63b4f380f9a8fb7541addfde6608bbc48b3267ad903f838afedb98e74ebfc --root-inventory-sha256 6978407b51e835a3893ac14cbb7ca2c46da48d0a778f2611f6de829af07bdf92
```

Search executes the compiled Core implementation. The v3 response uses
`result.tag` and `result.value`. Hits contain package_id, version, profile,
source_path, wit_route and delivery pins. Read the selected row's Root, then
its pinned Skill, WIT, manifest and declared SDK views.

`resolve` emits an exact `wasmc.public-lib-lock/v2` only after verifying the
catalog, manifest and complete Root inventory. It performs no semver selection
and grants neither engine admission nor Host authority. [Install](INSTALL.md)
with a separately approved lock digest and explicit mirror. Fourteen native-source
Roots remain source-only. Their bytes can be installed without establishing
Native execution or device acceptance. Older catalogs belong to their exact
immutable artifacts and are not the default current tooling route.
