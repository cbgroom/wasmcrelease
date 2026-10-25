# wasmc-json 0.0.7

A standalone Lib release compatible with the exact WAsmC v0.0.27 compiler, Canonical Host SDK and CoreLib included here. It adds `utf8::encode_parts_or(parts,max_bytes,fallback)`; existing JSON APIs and `utf8::encode` remain available. No compiler, SDK implementation, Host API or Native package was changed or rebuilt for this release.

Read `API.md` and `root/lib.wit`. `root/` is the complete original Lib Root with Core/Component views, generated Rust SDKs, license and notices. `checked-chunk-profile.json` binds the same fifteen existing asset roles and WASMCB01/v1 protocol. `compiler/`, `host/` and `cold/` supply the matching prebuilt compiler/SDK/Core, exact Host contracts and Root-specific template/transfer assets. Select the complete tuple; an old JSON0.0.6 template cannot be assumed to match this Root.

```wasmc
let mut parts:list<string> = list.new();
parts.push("{\"echo\":");
let fragment:string = document::compact_or(selected.values.get(0).json,"null");
parts.push(fragment);
parts.push("}");
let bytes:list<u8> = utf8::encode_parts_or(parts,65536,"{\"error\":\"assembly_failed\"}");
return {status:200,body:bytes};
```

Here `selected` comes from successful `document::inspect_values_bytes` selection with that value present. Materialize the selected JSON fragment through `compact_or` before moving it into the owning list. Directly pushing the borrowed field does not work on the current source path. Fragments must already be serialized JSON where JSON is intended; the joining operation does not escape, quote, parse or insert separators.

The joined UTF8 byte count is checked before one output allocation. Length overflow, exceeding `max_bytes`, or output allocation failure returns exactly the caller's fallback UTF8 bytes, with no partial joined result. The bound applies to joined bytes; fallback and every input/output still obey the normal transport/runtime budgets. The result does not separately identify fallback selection. Choose a complete error body/envelope and appropriate response policy; the example deliberately uses an explicit error body. Transport/OOM traps are separate from the documented fallback.

After extracting the complete bundle, run:

```sh
node verify.mjs
```

This verifies every byte and compiles ordinary source using only bundled public assets. It then runs the same installed App with new JSON/Unicode/NUL/large-integer inputs, explicit fallback, invalid input and recovery, using exactly thirteen mock HTTP Host functions. It makes no network/database/platform write. The runtime owns admission and actual deployment.

`release.json` records exact identities and qualification scope. The separate full-filter conformance fixture passes198B/1024B requests on both Wasmi2/Wasmtime49 at fixed10M fuel;4128B exhausts that budget on both. This is not an arbitrary-size fixed-budget full-filter guarantee. Original failure evidence is retained. Existing compiler Latest remains v0.0.27; this Lib is selected explicitly and carries no platform activation.

The prelinked HTTP App requires Wasm multi-memory. Node and Deno execute the complete conformance journey. Bun1.3.14 accepts the compiler/frame stage but rejects the merged multi-memory App; `bun verify.mjs --compiler-only` records that explicit boundary and earns no Guest-execution credit. Native Wasmi2/Wasmtime49 qualification is recorded separately.
