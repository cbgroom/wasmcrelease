# Canonical Host conformance fixture

This fixture uses ordinary WAsmC source, the original HTTP/Table contracts and
JSON0.0.6 producer assets. The complete Root is in
`standard/wasmc-json/0.0.6/`. Its manifest binds `document` and `utf8` APIs;
`utf8.encode` supplies the ordinary string-to-byte-list conversion.

`producer-assets/transfer.rs` is generated public Lib consumer glue. The raw
and prepared transfer modules, prepared Lib Core, caller plan and frame
descriptor preserve the qualified composition inputs. `expected-frame.json`
records the complete frame and all eight generated module identities.

The generic SDK accepts caller-selected contracts and Root bytes. The test
compares the compiler output with the independently produced Native frame,
checks rejection recovery and binds a new source on the same compiler instance.
It performs no application filesystem, database or network operation. Real
platform build/install and new external input acceptance are separate.

The previous JSON0.0.5 fixture bytes are preserved under
`admission/ordinary-canonical-host-v024/sdk-fixture-v006-c788-20261022/history-v005/`.
The immutable JSON0.0.5 Root and original failure receipts remain unchanged.

The merge recipe in `producer-assets/merge-assets.json` lists all eleven inputs
in their exact order, including `prepared-core-provider.wasm`. It records both
the raw successor Core artifact and its prepared identity while retaining the
`wasmc:lib/wasmc.lib_managed_object_heap@4.9.0` ABI namespace. The eight files
under `producer-assets/modules/` are the qualified SDK outputs.

From `examples/canonical-host/producer-assets/`, use the pinned Binaryen126
`wasm-merge` with this exact argument order:

```sh
wasm-merge prepared-transfer.wasm wasmc-value-staging \
  modules/caller.wasm wasmc-snapshot-caller \
  prepared-lib-core.wasm wasmc:lib/wasmc-json@0.0.6 \
  modules/lib-projection.wasm wasmc-native-value-projection \
  modules/lib-calls.wasm wasmc-native-value-calls \
  modules/canonical-entry.wasm wasmc-canonical-app-entry \
  modules/app-projection.wasm wasmc-app-value-projection \
  modules/host-entry.wasm wasmc-host-entry \
  modules/host-projection.wasm wasmc-host-value-projection \
  modules/host-calls.wasm wasmc-native-host-calls \
  prepared-core-provider.wasm wasmc:lib/wasmc.lib_managed_object_heap@4.9.0 \
  --rename-export-conflicts --all-features --quiet -o app.wasm
```

The expected App is 2,822,346 bytes with SHA256
`a2fa90d63eed06eede7da0678f67c303b22835aa939ad6c5915cd5ebff78d643`.
The recipe also binds the tool SHA256, original caller plan and memory binding.
Merging produces an artifact; it performs no Host operation.
