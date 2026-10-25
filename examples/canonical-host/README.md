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

## Optional operation demand in v0.0.26

Use app/static.wasmc for a static HTTP response or app/json-read.wasmc for JSON-only input. These ordinary sources use the same pinned activation and complete Host contracts. The SDK includes operation wrappers only when the caller actually imports an operation: static/read-only final Apps have13 HTTP imports, while ordinary.wasmc retains its Table transact and four error functions. Fixed eight-module framing and all pinned cold helper assets stay the same.

Run node scripts/test-canonical-host-import-demand.mjs for exact frame/module demand checks. import-demand-proof.json binds actual Binaryen126 final merges and HTTP-only execution with fresh inputs in the same installed instance; native-frame-proof.json independently proves direct Native and Wasmi2-hosted compiler frame parity for all three cases. These are finite compiler/SDK checks, separate from live MCPGit admission or its fuel limit.

## Checked byte transport in v0.0.27

The current canonical-host Wasm carrier emits checked8-byte transport directly inside its eight-module frame. Use the complete15-role map in `checked-chunk-profile.json` and `admission/checked-chunk-v027.json`. The current compiler facades and canonical preparation both select CoreLib4.11.0-candidate.1 at `current/lib_core.wasm` through `provider.core`. The frozen `standard/corelib/4.9.1` and every existing LibRoot remain unchanged. The4.9.0 link namespace is the existing Native ABI label. No SDK postprocessing or module replacement is required.

The same14inputs and strictWASMCB01/v1 descriptor work with frozen Native619321. A matching immutable compiler and canonical provider must be selected together. Full-tag manifest/checksums/modes own exact delivery identities. Consumer Host admission, actual Native installation and application activation remain separate from these SDK examples; no GREEN deployment is performed by this package.
