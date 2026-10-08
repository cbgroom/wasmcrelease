# Complete pinned current Root installation

Read [the exact current catalog](README.md). Resolve the selected Root using
its independent catalog, manifest and Root inventory pins. The following lock
is bound to Std1.4.1 at public artifact commit
`ff615bb67e998c6169fabaf9db7665c18500c987`:

```sh
wasmc_install_demo=$(mktemp -d)
node scripts/wasmc-lib.mjs resolve wasmc-std 1.4.1 --catalog-sha256 01fda278b3c74363643879f71cc739488a57e9d934f217ab07af3460b88923d4 --manifest-sha256 9db63b4f380f9a8fb7541addfde6608bbc48b3267ad903f838afedb98e74ebfc --root-inventory-sha256 6978407b51e835a3893ac14cbb7ca2c46da48d0a778f2611f6de829af07bdf92 > "$wasmc_install_demo/lock.json"
node scripts/wasmc-lib.mjs install "$wasmc_install_demo/lock.json" "$wasmc_install_demo/lib" --catalog-sha256 01fda278b3c74363643879f71cc739488a57e9d934f217ab07af3460b88923d4 --lock-sha256 628b796b6bb04ac0a2e105be56e6e46a10c2d2c8e6a7c2aba01d869644dccbdd --mirror github
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
original dependency notices. The independent Provider4.9 companion remains in
the verified tooling/product at `current/lib_core.wasm`; it is not part of this
single-Root install. The Base64 oracle reads the installed Root and verifies its
complete inventory before executing against that separately pinned Provider.

Installation grants no effect permission or engine admission. Core, Component,
native-source and physical-device evidence stay separate.
