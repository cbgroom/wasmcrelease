use wasmc_json_component::{Json, wasmtime::{Engine, Store, component::{Component, Linker}}};
use wasmc_json_component::exports::wasmc::json::document::{Edit, EditKind};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("missing component")?;
    let engine = Engine::default();
    let component = Component::from_file(&engine, path)?;
    let linker = Linker::<()>::new(&engine);
    let mut store = Store::new(&engine, ());
    let bindings = Json::instantiate(&mut store, &component, &linker)?;
    let doc = bindings.wasmc_json_document();
    for n in [0u64, 42, 1000000] {
        let input = format!("{{\"n\":{n}}}");
        let result = doc.call_read_u64(&mut store, input.as_bytes(), "/n")?.map_err(|e| format!("{e:?}"))?;
        assert!(result.present);
        assert_eq!(result.value, n);
    }
    let array = doc.call_array_from_values(&mut store, &["1".into(), "true".into(), "null".into()])?.map_err(|e| format!("{e:?}"))?;
    assert_eq!(array, "[1,true,null]");
    let edits = [
        Edit { kind: EditKind::Set, path: "/n".into(), value_json: "7".into() },
        Edit { kind: EditKind::Set, path: "/a/-".into(), value_json: "2".into() },
        Edit { kind: EditKind::Remove, path: "/b".into(), value_json: "".into() },
    ];
    let edited = doc.call_edit_bytes(&mut store, br#"{"n":42,"b":true,"a":[1]}"#, &edits)?.map_err(|e| format!("{e:?}"))?;
    assert_eq!(edited, br#"{"a":[1,2],"n":7}"#);
    let invalid = [Edit { kind: EditKind::Remove, path: "/missing".into(), value_json: "".into() }];
    assert!(doc.call_edit_bytes(&mut store, &edited, &invalid)?.is_err());
    let bad = doc.call_read_u64(&mut store, b"{", "/n")?;
    assert!(bad.is_err());
    let good = doc.call_compact(&mut store, " { \"ok\": true } ")?.map_err(|e| format!("{e:?}"))?;
    assert_eq!(good, "{\"ok\":true}");
    println!("PASS installed JSON Component SDK: three changing inputs, construction, ordered edits, invalid edit, malformed input and recovery");
    Ok(())
}
