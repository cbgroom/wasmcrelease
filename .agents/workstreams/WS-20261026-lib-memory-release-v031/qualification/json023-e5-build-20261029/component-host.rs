use wasmtime::{Engine, Store, component::{Component, Linker}};
wasmtime::component::bindgen!({ path: "/Users/youxianshi/code/.worktrees/wasmcrelease/WS-20261026-lib-memory-release-v031/libspec/wasmc-json/lib.wit", world: "json" });
use exports::wasmc::json::document::{Edit, EditKind, JsonField};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("missing component")?;
    let engine = Engine::default();
    let component = Component::from_file(&engine, path)?;
    let mut store = Store::new(&engine, ());
    let bindings = Json::instantiate(&mut store, &component, &Linker::<()>::new(&engine))?;
    let doc = bindings.wasmc_json_document();
    let payload = "x".repeat(17 * 1024 * 1024 + 1);
    let fields = [JsonField { name: "data".into(), value_json: format!("\"{payload}\"") },
                  JsonField { name: "n".into(), value_json: "1".into() }];
    let document = doc.call_object_from_fields(&mut store, &fields)?.map_err(|e| format!("{e:?}"))?;
    assert_eq!(document, format!("{{\"data\":\"{payload}\",\"n\":1}}"));
    let edits = [Edit { kind: EditKind::Set, path: "/n".into(), value_json: "18446744073709551615".into() },
                 Edit { kind: EditKind::Set, path: "/ok".into(), value_json: "true".into() }];
    let result = doc.call_edit_bytes(&mut store, document.as_bytes(), &edits)?.map_err(|e| format!("{e:?}"))?;
    assert_eq!(result, format!("{{\"data\":\"{payload}\",\"n\":18446744073709551615,\"ok\":true}}").as_bytes());
    let n = doc.call_read_u64(&mut store, &result, "/n")?.map_err(|e| format!("{e:?}"))?;
    assert!(n.present); assert_eq!(n.value, u64::MAX);
    let flag = doc.call_read_bool(&mut store, &result, "/ok")?.map_err(|e| format!("{e:?}"))?;
    assert!(flag.present && flag.value);
    let bad = [Edit { kind: EditKind::Remove, path: "/missing".into(), value_json: String::new() }];
    assert!(doc.call_edit_bytes(&mut store, &result, &bad)?.is_err());
    let n = doc.call_read_u64(&mut store, &result, "/n")?.map_err(|e| format!("{e:?}"))?;
    assert!(n.present); assert_eq!(n.value, u64::MAX);
    let recovery = doc.call_object_from_fields(&mut store, &[JsonField { name: "next".into(), value_json: "2".into() }])?.map_err(|e| format!("{e:?}"))?;
    assert_eq!(recovery, "{\"next\":2}");
    let depth=20_000;
    let deep=format!("{}0{}", "[".repeat(depth), "]".repeat(depth));
    let encoded=doc.call_compact_bytes(&mut store, deep.as_bytes())?.map_err(|e| format!("{e:?}"))?;
    assert_eq!(encoded,deep);
    let selected=doc.call_select_bytes(&mut store, deep.as_bytes(), &["/0".repeat(depth)])?.map_err(|e| format!("{e:?}"))?;
    assert_eq!(selected,vec![Some("0".to_string())]);
    println!("PASS Component:  {} payload bytes, constructor, ordered edits, typed reads, error and same-instance new-input recovery", payload.len());
    Ok(())
}
