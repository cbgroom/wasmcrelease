use wasmi::{Config, Engine, Linker, Memory, Module, Store, TypedFunc};
/// Exclusive resident reviewed Lib fixture; errors poison it, never replay.
pub struct ResidentSum {
    store: Store<()>,
    memory: Memory,
    ptr: i32,
    sum: TypedFunc<(i32, i32), i64>,
    poisoned: bool,
}
impl ResidentSum {
    pub fn new(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let mut config = Config::default();
        config.consume_fuel(true);
        let engine = Engine::new(&config);
        let module = Module::new(&engine, std::fs::read(path)?)?;
        let mut store = Store::new(&engine, ());
        store.set_fuel(10_000_000)?;
        let lib = Linker::new(&engine).instantiate_and_start(&mut store, &module)?;
        let alloc = lib.get_typed_func::<(i32, i32, i32, i32), i32>(&store, "cabi_realloc")?;
        let sum = lib.get_typed_func::<(i32, i32), i64>(&store, "sum-s32")?;
        let memory = lib.get_memory(&store, "memory").ok_or("memory missing")?;
        let ptr = alloc.call(&mut store, (0, 0, 4, 64))?;
        Ok(Self {
            store,
            memory,
            ptr,
            sum,
            poisoned: false,
        })
    }
    pub fn call(&mut self, bytes: &[u8]) -> Result<i64, Box<dyn std::error::Error>> {
        if self.poisoned || bytes.len() > 16 {
            return Err("poisoned or input budget".into());
        }
        self.poisoned = true;
        self.store.set_fuel(100_000)?;
        let packed: Vec<u8> = bytes
            .iter()
            .flat_map(|b| i32::from(*b).to_le_bytes())
            .collect();
        self.memory
            .write(&mut self.store, self.ptr as usize, &packed)?;
        let result = self
            .sum
            .call(&mut self.store, (self.ptr, bytes.len() as i32))?;
        self.poisoned = false;
        Ok(result)
    }
}
