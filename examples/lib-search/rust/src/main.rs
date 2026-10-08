use wasmc_lib_search_component::{
    exports::wasmc::lib_search::catalog::{Query, SearchError},
    wasmtime::{component::{Component, Linker}, Config, Engine, Store}, Lib,
};
use sha2::{Digest, Sha256};
fn input() -> (String, Vec<String>) {
    let bytes = std::fs::read(std::env::var("WASMC_SEARCH_INDEX_PATH").unwrap()).unwrap();
    assert_eq!(format!("{:x}", Sha256::digest(&bytes)), "73a1ebcce721a73dd8964030b7bb7bc61f2ed1d1aeb7d2aa46c22b8da8d8f333");
    let index: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let mut identities = Vec::new();
    for p in index["packages"].as_array().unwrap() {
        let id = format!("{}@{}", p["package_id"].as_str().unwrap(), p["version"].as_str().unwrap());
        identities.push(id.clone());
        for api in p["apis"].as_array().unwrap() { identities.push(format!("{id}/{}", api["route"].as_str().unwrap())); }
    }
    assert_eq!(identities.len(), 278);
    (String::from_utf8(bytes).unwrap(), identities)
}
fn main() {
    let root = std::env::var("WASMC_SEARCH_LIB_ROOT").unwrap();
    let (index, identities) = input();
    let mut config = Config::new(); config.wasm_component_model(true);
    let engine = Engine::new(&config).unwrap();
    let core = std::fs::read(format!("{root}/artifact.wasm")).unwrap();
    let component = std::fs::read(format!("{root}/component.wasm")).unwrap();
    assert_eq!(format!("{:x}", Sha256::digest(core)), wasmc_lib_search_component::LIB_ARTIFACT_SHA256);
    assert_eq!(format!("{:x}", Sha256::digest(&component)), wasmc_lib_search_component::LIB_COMPONENT_SHA256);
    let mut store = Store::new(&engine, ());
    let api = Lib::instantiate(&mut store, &Component::new(&engine, component).unwrap(), &Linker::new(&engine)).unwrap();
    let catalog = api.wasmc_lib_search_catalog();
    let snapshot = catalog.call_snapshot(&mut store, &index).unwrap().unwrap();
    assert_eq!((snapshot.entry_count, snapshot.package_count, snapshot.api_count, snapshot.bound_package_count), (278, 42, 236, 42));
    assert_eq!(snapshot.index_sha256, "73a1ebcce721a73dd8964030b7bb7bc61f2ed1d1aeb7d2aa46c22b8da8d8f333");
    for id in &identities { assert_eq!(catalog.call_lookup(&mut store, &index, id).unwrap().unwrap().unwrap().identity, *id); }
    let query = Query { text: String::new(), package_id: None, profile: None, bound_only: false };
    let mut all = Vec::new();
    for offset in (0..278).step_by(64) {
        all.extend(catalog.call_search(&mut store, &index, &query, offset, 64).unwrap().unwrap().into_iter().map(|h| h.identity));
    }
    assert_eq!(all, identities);
    let base64 = Query { text: "base64".into(), package_id: Some("wasmc-std".into()), profile: None, bound_only: true };
    let mut calls = 284;
    for _ in 0..256 {
        let hits = catalog.call_search(&mut store, &index, &base64, 0, 64).unwrap().unwrap();
        assert!(hits.len() >= 2); calls += 1;
        for hit in hits { assert_eq!(catalog.call_lookup(&mut store, &index, &hit.identity).unwrap().unwrap().unwrap().identity, hit.identity); calls += 1; }
    }
    assert!(catalog.call_lookup(&mut store, &index, "missing").unwrap().unwrap().is_none());
    assert!(matches!(catalog.call_search(&mut store, &index, &query, 0, 65).unwrap(), Err(SearchError::InvalidLimit)));
    assert!(matches!(catalog.call_snapshot(&mut store, "{}").unwrap(), Err(SearchError::InvalidIndex)));
    println!("{{\"accepted\":true,\"generated_sdk\":true,\"packages\":42,\"entries\":278,\"component_calls\":{}}}", calls + 3);
}
