use std::{error::Error, fs, path::PathBuf};
use wasmtime::{
    component::{Component, Linker, Val},
    Engine, Store,
};

fn release_file(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..").join(path)
}

#[test]
fn owned_algorithms_component_executes_list_contract() -> Result<(), Box<dyn Error>> {
    let engine = Engine::default();
    let component = Component::new(
        &engine,
        fs::read(release_file("libs/wasmc-owned-algorithms/component.wasm"))?,
    )?;
    let mut store = Store::new(&engine, ());
    let instance = Linker::new(&engine).instantiate(&mut store, &component)?;
    let algorithms = component
        .get_export_index(None, "wasmc:owned-algorithms/algorithms@0.1.0")
        .ok_or("algorithms interface missing")?;
    let sum = instance
        .get_func(
            &mut store,
            &component
                .get_export_index(Some(&algorithms), "sum-s32")
                .ok_or("sum-s32 missing")?,
        )
        .ok_or("sum-s32 function missing")?;
    let mut result = [Val::Bool(false)];
    sum.call(
        &mut store,
        &[Val::List(vec![Val::S32(5), Val::S32(-2), Val::S32(9)])],
        &mut result,
    )?;
    match result[0] {
        Val::S64(12) => Ok(()),
        ref value => Err(format!("sum-s32 returned {value:?}, expected 12").into()),
    }
}
