use wasmc_lib_search_component::{
    exports::wasmc::lib_search::catalog::{Query, SearchError},
    wasmtime::{
        component::{Component, Linker},
        Config, Engine, Store,
    },
    Lib,
};
fn main() {
    let root = std::env::var("WASMC_SEARCH_LIB_ROOT").unwrap();
    let mut config = Config::new();
    config.wasm_component_model(true);
    let engine = Engine::new(&config).unwrap();
    use sha2::{Digest, Sha256};
    let core_bytes = std::fs::read(format!("{root}/artifact.wasm")).unwrap();
    let component_bytes = std::fs::read(format!("{root}/component.wasm")).unwrap();
    assert_eq!(
        format!("{:x}", Sha256::digest(core_bytes)),
        wasmc_lib_search_component::LIB_ARTIFACT_SHA256
    );
    assert_eq!(
        format!("{:x}", Sha256::digest(&component_bytes)),
        wasmc_lib_search_component::LIB_COMPONENT_SHA256
    );
    let component = Component::new(&engine, component_bytes).unwrap();
    let mut store = Store::new(&engine, ());
    let api = Lib::instantiate(&mut store, &component, &Linker::new(&engine)).unwrap();
    let catalog = api.wasmc_lib_search_catalog();
    let snapshot = catalog.call_snapshot(&mut store).unwrap();
    assert_eq!(snapshot.entry_count, 145);
    assert_eq!(
        snapshot.index_sha256,
        "ca6d684eb3100f4629c8ff4f65c7d0b4f6bcd49fc24768e798c9a71a6fbf3ce5"
    );
    for _ in 0..100 {
        let hits = catalog
            .call_search(
                &mut store,
                &Query {
                    text: "base64".into(),
                    include_historical: false,
                },
                0,
                64,
            )
            .unwrap()
            .unwrap();
        assert_eq!(hits.len(), 3);
        for hit in hits {
            assert_eq!(
                catalog
                    .call_lookup(&mut store, &hit.identity)
                    .unwrap()
                    .unwrap()
                    .identity,
                hit.identity
            );
        }
    }
    assert!(catalog
        .call_lookup(&mut store, "missing")
        .unwrap()
        .is_none());
    assert!(matches!(
        catalog
            .call_search(
                &mut store,
                &Query {
                    text: "".into(),
                    include_historical: false
                },
                0,
                65
            )
            .unwrap(),
        Err(SearchError::InvalidLimit)
    ));
    println!("{{\"accepted\":true,\"generated_sdk\":true,\"component_calls\":403}}");
}
