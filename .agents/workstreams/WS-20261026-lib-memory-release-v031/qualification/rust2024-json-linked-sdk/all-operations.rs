// Ordinary application code compiled together with the selected built SDK.
use wasmc::json::{document::*, utf8::*};

#[unsafe(no_mangle)]
pub extern "C" fn run() -> u32 {
    let doc = "{\"a\":42,\"b\":\"雪\",\"flag\":true,\"neg\":-5,\"pi\":1.5}";
    let bytes = doc.as_bytes();
    let pointers = vec!["/a".to_string(), "/missing".to_string()];
    assert_eq!(compact(doc).unwrap(), doc);
    assert_eq!(compact_bytes(bytes).unwrap(), doc);
    assert!(validate(doc).is_ok());
    assert!(validate_bytes(bytes).is_ok());
    assert!(validate("{").is_err());
    assert_eq!(select(doc, &pointers).unwrap(), vec![Some("42".into()), None]);
    assert_eq!(select_bytes(bytes, &pointers).unwrap(), vec![Some("42".into()), None]);
    let text_values = select_values(doc, &pointers).unwrap();
    assert!(text_values[0].present && text_values[0].json == "42" && !text_values[1].present);
    let byte_values = select_values_bytes(bytes, &pointers).unwrap();
    assert!(byte_values[0].present && byte_values[0].json == "42" && !byte_values[1].present);
    let view = inspect_values_bytes(bytes, &pointers);
    assert!(view.valid && view.error.is_none() && view.values[0].json == "42" && !view.values[1].present);
    assert_eq!(compact_or_bytes(b"bad", "fallback"), "fallback");
    assert_eq!(select_string_or_bytes(bytes, "/b", "fallback"), "雪");
    assert_eq!(compact_or(doc, "fallback"), doc);
    assert_eq!(decode_string_or("\"雪\"", "fallback"), "雪");
    assert_eq!(quote_string("a\nb"), "\"a\\nb\"");
    let fields = vec![JsonField {name:"x".into(), value_json:"1".into()}];
    assert_eq!(object_from_fields(&fields).unwrap(), "{\"x\":1}");
    let items = vec!["1".to_string(), "true".to_string()];
    assert_eq!(array_from_values(&items).unwrap(), "[1,true]");
    assert_eq!(object_from_fields_or(&fields, "fallback"), "{\"x\":1}");
    assert_eq!(array_from_values_or(&items, "fallback"), "[1,true]");
    let edits = vec![Edit {kind:EditKind::Set, path:"/a".into(), value_json:"77".into()},
        Edit {kind:EditKind::Remove, path:"/flag".into(), value_json:"".into()}];
    let edited = "{\"a\":77,\"b\":\"雪\",\"neg\":-5,\"pi\":1.5}";
    assert_eq!(edit_bytes(bytes, &edits).unwrap(), edited.as_bytes());
    assert_eq!(edit_or_bytes(bytes, &edits, "fallback"), edited);
    assert_eq!(read_u64(bytes, "/a").unwrap().value, 42);
    assert_eq!(read_i64(bytes, "/neg").unwrap().value, -5);
    assert_eq!(read_f64(bytes, "/pi").unwrap().value, 1.5);
    assert!(read_bool(bytes, "/flag").unwrap().value);
    assert!(!read_u64(bytes, "/missing").unwrap().present);
    assert_eq!(encode("雪"), "雪".as_bytes());
    assert_eq!(encode_parts(&["雪".into(), "!".into()]), "雪!".as_bytes());
    26
}
