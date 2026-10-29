use wasmc_json_component::{Json, wasmtime::{Engine, Store, component::{Component, Linker}}};
use wasmc_json_component::exports::wasmc::json::document::{Edit, EditKind, JsonField};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("missing component")?;
    let engine = Engine::default();
    let component = Component::from_file(&engine, path)?;
    let mut store = Store::new(&engine, ());
    let bindings = Json::instantiate(&mut store, &component, &Linker::<()>::new(&engine))?;
    let doc = bindings.wasmc_json_document();
    let fields: Vec<_> = (0..1_000_000).map(|i| JsonField {name:format!("k{i:07}"),value_json:i.to_string()}).collect();
    let document=doc.call_object_from_fields(&mut store, &fields)?.map_err(|e|format!("{e:?}"))?;
    let edits: Vec<_> = (0..100_000).map(|i| Edit {kind:EditKind::Set,path:format!("/k{i:07}"),value_json:(i+1_000_000).to_string()}).collect();
    let result=doc.call_edit_bytes(&mut store,document.as_bytes(),&edits)?.map_err(|e|format!("{e:?}"))?;
    for (name,want) in [("/k0000000",1_000_000),("/k0099999",1_099_999),("/k0100000",100_000),("/k0999999",999_999)] {
        let value=doc.call_read_u64(&mut store,&result,name)?.map_err(|e|format!("{e:?}"))?;
        assert!(value.present);assert_eq!(value.value,want);
    }
    let invalid=[Edit{kind:EditKind::Set,path:"/k0000000".into(),value_json:"1".into()},Edit{kind:EditKind::Remove,path:"/not-present".into(),value_json:String::new()}];
    assert!(doc.call_edit_bytes(&mut store,&result,&invalid)?.is_err());
    let value=doc.call_read_u64(&mut store,&result,"/k0000000")?.map_err(|e|format!("{e:?}"))?;assert_eq!(value.value,1_000_000);
    let fresh=doc.call_object_from_fields(&mut store,&[JsonField{name:"new".into(),value_json:"42".into()}])?.map_err(|e|format!("{e:?}"))?;
    assert_eq!(fresh,"{\"new\":42}");
    println!("PASS candidate Component 1000000 fields, 100000 edits, typed reads, failed batch and same-instance fresh input; bytes={}",result.len());
    Ok(())
}
