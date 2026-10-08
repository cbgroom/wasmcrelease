# Exact current Lib selection

The v0.0.21 current catalog is `libs-current-v2.json`, schema
`wasmc.public-lib-catalog/v2`. Its independently reviewed SHA256 is
`a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad`. It binds42 complete current Roots and their236 WIT API routes.
The package artifact authority is immutable public commit
`57f03cf6c0f2a98b37ea9c2294046ccd6644c1ba`.

```sh
node scripts/wasmc-lib.mjs search "base64 decode" --catalog-sha256 a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad --limit 8
node scripts/wasmc-lib.mjs resolve wasmc-std 1.4.1 --catalog-sha256 a4de009c683d3db4453cf0a9e783719a933a8e1689842a12d08a6883a83cfdad --manifest-sha256 9db63b4f380f9a8fb7541addfde6608bbc48b3267ad903f838afedb98e74ebfc --root-inventory-sha256 6978407b51e835a3893ac14cbb7ca2c46da48d0a778f2611f6de829af07bdf92
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
