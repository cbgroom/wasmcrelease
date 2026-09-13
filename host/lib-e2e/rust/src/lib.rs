pub mod app_engine;
pub mod listener;
pub mod resident_app;
pub mod resident_sum;
pub mod tcp;
pub mod udp;
#[cfg(feature = "wasmtime-engine")]
pub mod wasmtime_app;

/// Reviewed fixture marshalling into the frozen zero-import algorithm Lib.
pub fn sum_bytes(bytes: &[u8], lib_path: &str) -> Result<i64, Box<dyn std::error::Error>> {
    use wasmi::{Config, Engine, Linker, Module, Store};
    if bytes.len() > 16 {
        return Err("fixture input budget".into());
    }
    let mut config = Config::default();
    config.consume_fuel(true);
    let engine = Engine::new(&config);
    let module = Module::new(&engine, std::fs::read(lib_path)?)?;
    let mut store = Store::new(&engine, ());
    store.set_fuel(10_000_000)?;
    let lib = Linker::new(&engine).instantiate_and_start(&mut store, &module)?;
    let alloc = lib.get_typed_func::<(i32, i32, i32, i32), i32>(&store, "cabi_realloc")?;
    let sum = lib.get_typed_func::<(i32, i32), i64>(&store, "sum-s32")?;
    let memory = lib.get_memory(&store, "memory").ok_or("memory missing")?;
    let ptr = alloc.call(&mut store, (0, 0, 4, 64))?;
    let packed: Vec<u8> = bytes
        .iter()
        .flat_map(|b| i32::from(*b).to_le_bytes())
        .collect();
    memory.write(&mut store, ptr as usize, &packed)?;
    let result = sum.call(&mut store, (ptr, bytes.len() as i32))?;
    alloc.call(&mut store, (ptr, 64, 4, 0))?;
    Ok(result)
}
