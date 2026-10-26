use std::{env, fs};
use wasmc_text_component::{Lib, wasmtime};
use wasmtime::{Engine, Store};
use wasmtime::component::{Component, Linker};
fn main() {
    let args: Vec<_> = env::args().collect();
    let engine = Engine::default();
    let component = Component::new(&engine, fs::read(&args[1]).unwrap()).unwrap();
    let mut store = Store::new(&engine, ());
    let lib = Lib::instantiate(&mut store, &component, &Linker::new(&engine)).unwrap();
    let text = lib.wasmc_text_text();
    for round in 0..256 {
        assert_eq!(text.call_to_uppercase(&mut store, "Straße").unwrap(), "STRASSE");
        assert_eq!(text.call_find(&mut store, "雪🦀x", "x").unwrap(), Some(7));
        assert_eq!(text.call_from_utf8_or(&mut store, &[255], "fallback").unwrap(), "fallback");
        assert!(text.call_contains(&mut store, &format!("fresh-{round}-雪"), "雪").unwrap());
    }
    let value = format!("{}雪🦀", "a".repeat(3 * 1024 * 1024));
    assert_eq!(text.call_to_uppercase(&mut store, &value).unwrap(), format!("{}雪🦀", "A".repeat(3 * 1024 * 1024)));
    let items = vec!["x".to_string(); 70000];
    assert_eq!(text.call_join(&mut store, &items, "").unwrap(), "x".repeat(70000));
    assert_eq!(text.call_to_lowercase(&mut store, "İA").unwrap(), "i\u{307}a");
    println!("{{\"accepted\":true,\"engine\":\"wasmtime-component\",\"version\":\"49.0.0\",\"rounds\":256,\"large_input_bytes\":3145728,\"input_strings\":70000,\"same_instance_new_inputs\":true}}");
}
