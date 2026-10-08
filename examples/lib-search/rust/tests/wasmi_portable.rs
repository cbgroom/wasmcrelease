use wasmi::{Engine, Linker, Module, Store};
use sha2::{Digest, Sha256};
#[test]
fn current_core_snapshot_search_lookup_and_post_return_without_jit() {
    let root = std::env::var("WASMC_SEARCH_LIB_ROOT").unwrap();
    let bytes = std::fs::read(format!("{root}/artifact.wasm")).unwrap();
    assert_eq!(format!("{:x}", Sha256::digest(&bytes)), wasmc_lib_search_component::LIB_ARTIFACT_SHA256);
    let index = std::fs::read(std::env::var("WASMC_SEARCH_INDEX_PATH").unwrap()).unwrap();
    assert_eq!(format!("{:x}", Sha256::digest(&index)), "73a1ebcce721a73dd8964030b7bb7bc61f2ed1d1aeb7d2aa46c22b8da8d8f333");
    let engine = Engine::default(); let module = Module::new(&engine, &bytes[..]).unwrap();
    assert_eq!(module.imports().count(), 0);
    let mut store = Store::new(&engine, ());
    let instance = Linker::<()>::new(&engine).instantiate_and_start(&mut store, &module).unwrap();
    let prefix = "wasmc:lib-search/catalog@0.5.0#";
    let memory = instance.get_memory(&store, "memory").unwrap();
    let alloc = instance.get_typed_func::<(i32,i32,i32,i32),i32>(&store,"cabi_realloc").unwrap();
    let snapshot = instance.get_typed_func::<(i32,i32),i32>(&store,&format!("{prefix}snapshot")).unwrap();
    let post_snapshot = instance.get_typed_func::<i32,()>(&store,&format!("cabi_post_{prefix}snapshot")).unwrap();
    let search = instance.get_typed_func::<(i32,i32,i32,i32,i32,i32,i32,i32,i32,i32,i32,i32,i32),i32>(&store,&format!("{prefix}search")).unwrap();
    let post_search = instance.get_typed_func::<i32,()>(&store,&format!("cabi_post_{prefix}search")).unwrap();
    let lookup = instance.get_typed_func::<(i32,i32,i32,i32),i32>(&store,&format!("{prefix}lookup")).unwrap();
    let post_lookup = instance.get_typed_func::<i32,()>(&store,&format!("cabi_post_{prefix}lookup")).unwrap();
    let put = |store:&mut Store<()>,bytes:&[u8]| {let p=alloc.call(&mut *store,(0,0,1,bytes.len()as i32)).unwrap();memory.write(&mut *store,p as usize,bytes).unwrap();p};
    let mut stable = None;
    for _ in 0..256 {
        let p=put(&mut store,&index);let result=snapshot.call(&mut store,(p,index.len()as i32)).unwrap();
        let mut v=[0;36];memory.read(&store,result as usize,&mut v).unwrap();assert_eq!(v[0],0);
        let n=|i|u32::from_le_bytes(v[i..i+4].try_into().unwrap());
        assert_eq!((n(4),n(8),n(12),n(16)),(278,42,236,42));post_snapshot.call(&mut store,result).unwrap();
        let p=put(&mut store,&index);let q=put(&mut store,b"base64");
        let result=search.call(&mut store,(p,index.len()as i32,q,6,0,0,0,0,0,0,1,0,64)).unwrap();
        let mut v=[0;12];memory.read(&store,result as usize,&mut v).unwrap();assert_eq!(v[0],0);assert!(u32::from_le_bytes(v[8..].try_into().unwrap())>=2);post_search.call(&mut store,result).unwrap();
        let identity=b"wasmc-std@1.4.1/base64#try-decode-standard";
        let p=put(&mut store,&index);let q=put(&mut store,identity);let result=lookup.call(&mut store,(p,index.len()as i32,q,identity.len()as i32)).unwrap();
        let mut v=[0;16];memory.read(&store,result as usize,&mut v).unwrap();assert_eq!((v[0],v[4]),(0,1));
        let ptr=u32::from_le_bytes(v[8..12].try_into().unwrap());let len=u32::from_le_bytes(v[12..16].try_into().unwrap());let mut text=vec![0;len as usize];memory.read(&store,ptr as usize,&mut text).unwrap();assert_eq!(text,identity);post_lookup.call(&mut store,result).unwrap();
        let size=memory.data(&store).len();assert!(size<=16*1024*1024);if let Some(previous)=stable{assert_eq!(size,previous)}else{stable=Some(size)}
    }
    println!("CURRENT_SEARCH_WASMI rounds=256 calls=768 post_returns=768 persistent_memory_bytes={}",stable.unwrap());
}
