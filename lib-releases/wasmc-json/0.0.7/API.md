# JSON0.0.7: ordered UTF8 parts with explicit fallback

Additive successor to JSON0.0.6. Old document operations, encode, logic.rs, dependency versions, license and notices are unchanged.

`utf8.encode-parts-or(parts:list<string>,max-bytes:u32,fallback:string)->list<u8>` concatenates exact UTF8 bytes in order, including NUL. It does not parse, quote or escape JSON, insert separators, normalize text or call the Host. Supply correctly serialized fragments when JSON is intended.

Rust checks total byte length before one output allocation and extends by each complete slice: O(parts + total bytes), no growing-prefix recopy and no per-byte Host calls. Empty parts succeed at a zero bound. Length overflow, output beyond max-bytes, or try_reserve_exact failure returns exactly fallback.into_bytes(), with no partial output. max-bytes applies to successful concatenation, not to caller fallback; every returned value remains subject to the general Canonical transport budget. Input transport allocation failures/traps remain separate.

The explicit fallback follows the existing compact-or pattern and can be a complete application error JSON envelope. The byte result does not separately signal which path was taken; choose a fallback appropriate to the caller contract. It must not be interpreted as implicit success or a claim that arbitrary fragments form valid JSON.

The ordinary example chooses an explicit error body for /small. Production callers choose their own fallback envelope/status policy. The new operation is a single Lib call; no compiler/SDK/CoreLib syntax, schema or Host ABI extension is intended.

Normal lib build and strict lib verify are required; Rust tests alone do not qualify Core/Component or Canonical Host consumers.

For selected JSON values, materialize each fragment before moving it into the parts list:

```wasmc
let mut parts:list<string> = list.new();
parts.push("{\"echo\":");
let fragment:string = document::compact_or(selected.values.get(0).json,"null");
parts.push(fragment);
parts.push("}");
let bytes:list<u8> = utf8::encode_parts_or(parts,65536,"{\"error\":\"assembly_failed\"}");
return {status:200,body:bytes};
```

`selected` must come from a successful `document.inspect-values-bytes` selection with the value present. Its `json` field is already a complete bounded JSON value; `compact-or` preserves that value and supplies an independent value for the owning list. Directly moving `selected.values.get(0).json` into the list does not work on the current ordinary source path; merely assigning it another local name is insufficient. Original failure controls remain in the owning workstream evidence. This example's fallback is an explicit error body; an HTTP exchange caller can instead supply its complete error-response envelope.
