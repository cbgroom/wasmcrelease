# JSON and independent UTF8 encoding

The additive `wasmc-json` 0.0.6 producer preserves all thirteen 0.0.5 `document` APIs and the original `logic.rs` bytes. The independent `utf8` interface adds `encode(input: string) -> list<u8>`, implemented by Rust `String::into_bytes`. It returns exactly the input's UTF-8 bytes, including embedded NUL, and consumes the owned String buffer without allocating another payload buffer inside this Lib.

The JSON parser, selector, compact/decode projections, errors and error precedence remain unchanged. JSON input/output bounds remain 65536 bytes, container depth 64, pointer count 64 and pointer length 1024 bytes. These JSON-specific bounds do not apply to independent UTF8 conversion; the existing general Canonical transport budgets still apply. The new operation performs no JSON parsing or Host calls.

The original pinned serde_json 1.0.151 and wit-bindgen 0.57.1 dependencies, dependency lock entries, license and dependency notices are retained. Only this package's own version changes in Cargo.toml and Cargo.lock. Original examples and previously published Roots remain separate immutable inputs.

`workspace/json-adapter/src/utf8.rs` contains the shared production conversion and tests that invoke the actual WIT `Component as utf8::Guest` implementation. The expected bytes cover empty, ASCII, Unicode, NUL, 1 KiB and 64 KiB input, plus ownership-buffer reuse. These unit tests do not qualify Canonical interoperation; actual Core/WIT/SDK execution across memory boundaries is a separate required check.

The normal package producer validates the complete fourteen-operation WIT/Core/Component interface:

```sh
WASMC_JSON_UTF8_PUBLICATION="$(mktemp -d /tmp/wasmc-json-utf8.XXXXXX)"
wasmc lib build \
  --workspace "$PWD/examples/wasmc_lib_json_utf8_v1/workspace" \
  --publication "$WASMC_JSON_UTF8_PUBLICATION" \
  examples/wasmc_lib_json_utf8_v1/lib.build.json
```

This directory is a source recipe. Native tests, actual package production, generated SDK/runtime compatibility and formal publication are separate validation steps.
