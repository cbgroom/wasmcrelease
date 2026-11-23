# Complete pinned current Root installation

Read [the exact current catalog](README.md). Resolve the selected Root using
its independent catalog, manifest and Root inventory pins. The following lock
is bound to Std 1.5.2 at public artifact commit
`f0166ba76b8613f6decd1ab7c362ca8a9cd90031`:

```sh
wasmc_install_demo=$(mktemp -d)
node scripts/wasmc-lib.mjs resolve wasmc-std 1.5.2 --catalog-sha256 ac32312f3e06f7ca2b3f8e20d66ecd4914f1ffd10ad45ae1cef4ff06a9628192 --manifest-sha256 229df2e763411febc2f3fd275666265833a53f6f9f3c03e44b9d6b0cd9411338 --root-inventory-sha256 86ea6bc3c5f7f49b3656e79cd1db9c23440235b673f0595309d05375556fea1d > "$wasmc_install_demo/lock.json"
node scripts/wasmc-lib.mjs install "$wasmc_install_demo/lock.json" "$wasmc_install_demo/lib" --catalog-sha256 ac32312f3e06f7ca2b3f8e20d66ecd4914f1ffd10ad45ae1cef4ff06a9628192 --lock-sha256 bdcce45fef79c1cd7bd7e146b7f3d00353c4f1dee3a8fad9f9364f5471b34734 --mirror github
node examples/base64/run.mjs --installed "$wasmc_install_demo/lib"
```

The approved lock digest binds the exact pretty-printed resolver output and
newline. Changed formatting requires independent review of the new bytes.
Choose `--mirror jsdelivr` explicitly when desired. There is no mirror fallback,
mutable URL or custom endpoint. Every Root file is checked before exclusive
publication; an occupied destination is rejected, including an empty directory.
The installer publishes a symlink to its retained complete staging directory.

The selected package is under `current-libs/wasmc-std/1.5.2` inside the destination.
It includes WIT, Core/Component artifacts, generated SDKs, metadata, LICENSE and
original dependency notices. The independent CoreLib 4.12.0-candidate.1 companion remains in
the verified tooling/product at `current/lib_core.wasm`; it is not part of this
single-Root install. The Base64 oracle reads the installed Root and verifies its
complete inventory before executing against that separately pinned Provider.

Installation grants no effect permission or engine admission. Core, Component,
native-source and physical-device evidence stay separate.
