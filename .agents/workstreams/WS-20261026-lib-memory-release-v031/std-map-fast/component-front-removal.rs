use std::{env, fs};
use wasmc_std_component::{Lib, wasmtime};
use wasmtime::component::{Component, Linker};
fn main() {
    let path = env::args().nth(1).expect("component path");
    let engine = wasmtime::Engine::default();
    let component = Component::new(&engine, fs::read(path).unwrap()).unwrap();
    let mut store = wasmtime::Store::new(&engine, ());
    let lib = Lib::instantiate(&mut store, &component, &Linker::new(&engine)).unwrap();
    let api = lib.wasmc_std_map();
    let map = api.call_new(&mut store).unwrap();
    const N: i32 = 1_000_000;
    for i in 0..N { assert_eq!(api.call_insert(&mut store, map, i, i * 2).unwrap(), None); }
    assert_eq!(api.call_len(&mut store, map).unwrap(), N as u32);
    for i in [0,1,256,257,65535,500000,N-1] { assert_eq!(api.call_get(&mut store,map,i).unwrap(),Some(i*2)); }
    for i in [0,257,500000,N-1] { assert_eq!(api.call_insert(&mut store,map,i,-i-1).unwrap(),Some(i*2)); }
    for i in 0..1000 { let expected = if i == 0 { -1 } else if i == 257 { -258 } else { i * 2 }; assert_eq!(api.call_remove(&mut store,map,i).unwrap(),Some(expected)); }
    assert_eq!(api.call_len(&mut store,map).unwrap(),(N-1000) as u32);
    api.call_clear(&mut store,map).unwrap();assert_eq!(api.call_len(&mut store,map).unwrap(),0);
    assert_eq!(api.call_insert(&mut store,map,77,-9).unwrap(),None);assert_eq!(api.call_get(&mut store,map,77).unwrap(),Some(-9));
    map.resource_drop(&mut store).unwrap();
    println!("{{\"accepted\":true,\"engine\":\"wasmtime-component\",\"version\":\"49.0.0\",\"inserted\":1000000,\"replaced\":4,\"removed\":1000,\"clear_and_reuse\":true,\"resource_drop\":true,\"formal_release\":false}}");
}
