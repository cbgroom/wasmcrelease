use wasmi::{Engine, Linker, Module, Store};

#[test]
fn formal_core_snapshot_search_and_post_return_execute_without_jit() {
    let root =
        std::env::var("WASMC_SEARCH_LIB_ROOT").expect("explicit qualified Lib root required");
    let bytes = std::fs::read(format!("{root}/artifact.wasm")).unwrap();
    let engine = Engine::default();
    let module = Module::new(&engine, &bytes[..]).unwrap();
    assert_eq!(module.imports().count(), 0);
    let mut store = Store::new(&engine, ());
    let instance = Linker::<()>::new(&engine)
        .instantiate_and_start(&mut store, &module)
        .unwrap();
    let prefix = "wasmc:lib-search/catalog@0.1.0#";
    let memory = instance.get_memory(&store, "memory").unwrap();
    let snapshot = instance
        .get_typed_func::<(), i32>(&store, &format!("{prefix}snapshot"))
        .unwrap();
    let post_snapshot = instance
        .get_typed_func::<i32, ()>(&store, &format!("cabi_post_{prefix}snapshot"))
        .unwrap();
    let ptr = snapshot.call(&mut store, ()).unwrap() as usize;
    let mut buf = [0; 8];
    memory.read(&store, ptr, &mut buf).unwrap();
    assert_eq!(u32::from_le_bytes(buf[..4].try_into().unwrap()), 1);
    assert_eq!(u32::from_le_bytes(buf[4..].try_into().unwrap()), 89);
    post_snapshot.call(&mut store, ptr as i32).unwrap();
    let alloc = instance
        .get_typed_func::<(i32, i32, i32, i32), i32>(&store, "cabi_realloc")
        .unwrap();
    let search = instance
        .get_typed_func::<(i32, i32, i32, i32, i32), i32>(&store, &format!("{prefix}search"))
        .unwrap();
    let post = instance
        .get_typed_func::<i32, ()>(&store, &format!("cabi_post_{prefix}search"))
        .unwrap();
    for _ in 0..100 {
        let text = b"base64";
        let p = alloc
            .call(&mut store, (0, 0, 1, text.len() as i32))
            .unwrap();
        memory.write(&mut store, p as usize, text).unwrap();
        let result = search
            .call(&mut store, (p, text.len() as i32, 0, 0, 64))
            .unwrap();
        let mut value = [0; 12];
        memory.read(&store, result as usize, &mut value).unwrap();
        assert_eq!(value[0], 0);
        assert_eq!(u32::from_le_bytes(value[8..12].try_into().unwrap()), 3);
        post.call(&mut store, result).unwrap();
    }
}
