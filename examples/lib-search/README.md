# Current LibSearch 0.5.0 consumer

Read the exact [current catalog](../../catalog/README.md). The index is explicit
[catalog data](../../catalog/current-index-v2.json), with 42 packages, 236 exported
APIs and 278 entries. The executable Search Root is
[LibSearch 0.5.0](../../standard/wasmc-lib-search/0.5.0/). The public metadata pins
the complete Root and its manifest-owned Core and Component SDK paths.

Run `node examples/lib-search/run.mjs` for the complete Root/index closure and
256 persistent current Core lookup rounds. The Rust consumer runs the actual
import-free Core with Wasmi 2 and the generated Component SDK with its declared
Wasmtime dependency. Both consume the same exact index; they verify snapshots,
lookup/search and post-return cleanup separately.

```sh
WASMC_SEARCH_LIB_ROOT="$PWD/standard/wasmc-lib-search/0.5.0" WASMC_SEARCH_INDEX_PATH="$PWD/catalog/current-index-v2.json" cargo +1.96.0 test --locked --manifest-path examples/lib-search/rust/Cargo.toml
WASMC_SEARCH_LIB_ROOT="$PWD/standard/wasmc-lib-search/0.5.0" WASMC_SEARCH_INDEX_PATH="$PWD/catalog/current-index-v2.json" cargo +1.96.0 run --locked --manifest-path examples/lib-search/rust/Cargo.toml
```

Index discovery is not release admission, installation or Host authority.
Fourteen native-source entries remain source-only. Historical LSI fixtures are
retained for their immutable historical products; current commands do not use
them.
