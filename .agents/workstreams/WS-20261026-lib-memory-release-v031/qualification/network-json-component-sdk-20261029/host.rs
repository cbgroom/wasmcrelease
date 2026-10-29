use wasmc_json_component::{Json, wasmtime::{Engine, Store, component::{Component, Linker}}};
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
    let bad = doc.call_read_u64(&mut store, b"{", "/n")?;
    assert!(bad.is_err());
    let good = doc.call_compact(&mut store, " { \"ok\": true } ")?.map_err(|e| format!("{e:?}"))?;
    assert_eq!(good, "{\"ok\":true}");
    println!("PASS installed JSON Component SDK: three changing inputs, malformed input and recovery");
    Ok(())
}
