# Complete pinned current Root installation

Read [the exact current catalog](README.md). Resolve the selected Root using
its independent catalog, manifest and Root inventory pins. The following lock
is bound to Std1.4.1 at public artifact commit
`0e91db5e63ab5750cb621add5ad48a5581aedfa1`:

```sh
wasmc_install_demo=$(mktemp -d)
node scripts/wasmc-lib.mjs resolve wasmc-std 1.4.1 --catalog-sha256 c583d5444d9bcba8f5932660d5b632fd64aa9a212c2002f1a91fa03b9d4e0aa9 --manifest-sha256 9db63b4f380f9a8fb7541addfde6608bbc48b3267ad903f838afedb98e74ebfc --root-inventory-sha256 6978407b51e835a3893ac14cbb7ca2c46da48d0a778f2611f6de829af07bdf92 > "$wasmc_install_demo/lock.json"
node scripts/wasmc-lib.mjs install "$wasmc_install_demo/lock.json" "$wasmc_install_demo/lib" --catalog-sha256 c583d5444d9bcba8f5932660d5b632fd64aa9a212c2002f1a91fa03b9d4e0aa9 --lock-sha256 8b9d7c35172774af2863d7bbab7014c5238243d8bf6ca2155c3cace60231f2b9 --mirror github
node examples/base64/run.mjs --installed "$wasmc_install_demo/lib"
```

The approved lock digest binds the exact pretty-printed resolver output and
newline. Changed formatting requires independent review of the new bytes.
Choose `--mirror jsdelivr` explicitly when desired. There is no mirror fallback,
mutable URL or custom endpoint. Every Root file is checked before exclusive
publication; an occupied destination is rejected, including an empty directory.
The installer publishes a symlink to its retained complete staging directory.

The selected package is under `current-libs/wasmc-std/1.4.1` inside the destination.
It includes WIT, Core/Component artifacts, generated SDKs, metadata, LICENSE and
original dependency notices. The independent Provider4.9.1 companion remains in
the verified tooling/product at `current/lib_core.wasm`; it is not part of this
single-Root install. The Base64 oracle reads the installed Root and verifies its
complete inventory before executing against that separately pinned Provider.

Installation grants no effect permission or engine admission. Core, Component,
native-source and physical-device evidence stay separate.
