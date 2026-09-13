//! Public integration glue. Compiler implementation remains opaque Core Wasm.
use sha2::{Digest, Sha256};
use wasmi::{
    Config, Engine, Instance, Linker, Memory, Module, Store, StoreLimits, StoreLimitsBuilder,
};

const COMPILER: &[u8] = include_bytes!("../../../current/wasmc_compiler.wasm");
pub const COMPILER_SHA256: &str =
    "93d946c544975a6e7642ff1f5890e09d3bfb9924d0256ffcfebcf07485597c90";

#[derive(Clone, Copy)]
pub struct Limits {
    pub fuel: u64,
    pub memory_bytes: usize,
    pub source_bytes: usize,
    pub output_bytes: usize,
}
impl Default for Limits {
    fn default() -> Self {
        Self {
            fuel: 500_000_000,
            memory_bytes: 256 * 1024 * 1024,
            source_bytes: 1024 * 1024,
            output_bytes: 16 * 1024 * 1024,
        }
    }
}

/// Exclusive resident compiler. A trapped/failed cleanup poisons the instance;
/// callers must construct a new one, never retry an uncertain operation.
pub struct Compiler {
    store: Store<StoreLimits>,
    instance: Instance,
    memory: Memory,
    limits: Limits,
    poisoned: bool,
}
impl Compiler {
    pub fn new(limits: Limits) -> Result<Self, String> {
        if limits.fuel == 0
            || limits.memory_bytes == 0
            || limits.source_bytes == 0
            || limits.output_bytes == 0
        {
            return Err("limits must be nonzero".into());
        }
        if format!("{:x}", Sha256::digest(COMPILER)) != COMPILER_SHA256 {
            return Err("compiler digest mismatch".into());
        }
        let mut config = Config::default();
        config.consume_fuel(true);
        let engine = Engine::new(&config);
        let module = Module::new(&engine, COMPILER).map_err(|e| e.to_string())?;
        if module.imports().next().is_some() {
            return Err("compiler imports rejected".into());
        }
        let mut store = Store::new(
            &engine,
            StoreLimitsBuilder::new()
                .memory_size(limits.memory_bytes)
                .memories(1)
                .instances(1)
                .tables(1)
                .build(),
        );
        store.limiter(|limits| limits);
        store.set_fuel(limits.fuel).map_err(|e| e.to_string())?;
        let instance = Linker::new(&engine)
            .instantiate_and_start(&mut store, &module)
            .map_err(|e| e.to_string())?;
        let memory = instance
            .get_memory(&store, "memory")
            .ok_or("missing compiler memory")?;
        Ok(Self {
            store,
            instance,
            memory,
            limits,
            poisoned: false,
        })
    }
    fn call0(&mut self, name: &str) -> Result<i32, String> {
        self.instance
            .get_typed_func::<(), i32>(&self.store, name)
            .map_err(|e| e.to_string())?
            .call(&mut self.store, ())
            .map_err(|e| e.to_string())
    }
    fn copy(&mut self, prefix: &str) -> Result<Vec<u8>, String> {
        let pointer = self.call0(&format!("wasmc_{prefix}_ptr"))? as u32 as usize;
        let length = self.call0(&format!("wasmc_{prefix}_len"))? as u32 as usize;
        if length > self.limits.output_bytes {
            return Err("output limit exceeded".into());
        }
        let mut bytes = vec![0; length];
        self.memory
            .read(&self.store, pointer, &mut bytes)
            .map_err(|e| e.to_string())?;
        Ok(bytes)
    }
    pub fn compile(&mut self, source: &str) -> Result<Vec<u8>, String> {
        if self.poisoned {
            return Err("compiler instance poisoned".into());
        }
        if source.len() > self.limits.source_bytes || source.len() > i32::MAX as usize {
            return Err("source limit exceeded".into());
        }
        self.store
            .set_fuel(self.limits.fuel)
            .map_err(|e| e.to_string())?;
        self.poisoned = true;
        let result = self.compile_inner(source);
        // Separate bounded cleanup budget even when compile exhausted fuel.
        self.store
            .set_fuel(self.limits.fuel)
            .map_err(|e| e.to_string())?;
        self.instance
            .get_typed_func::<(), ()>(&self.store, "wasmc_clear")
            .map_err(|e| e.to_string())?
            .call(&mut self.store, ())
            .map_err(|e| e.to_string())?;
        // Compilation diagnostics are safe to reuse; execution traps are not.
        if let Ok((status, bytes)) = result {
            self.poisoned = false;
            if status == 0 {
                Ok(bytes)
            } else {
                Err(String::from_utf8_lossy(&bytes).into_owned())
            }
        } else {
            result.map(|(_, bytes)| bytes)
        }
    }
    fn compile_inner(&mut self, source: &str) -> Result<(i32, Vec<u8>), String> {
        let pointer = self
            .instance
            .get_typed_func::<i32, i32>(&self.store, "wasmc_alloc")
            .map_err(|e| e.to_string())?
            .call(&mut self.store, source.len() as i32)
            .map_err(|e| e.to_string())?;
        self.memory
            .write(&mut self.store, pointer as u32 as usize, source.as_bytes())
            .map_err(|e| e.to_string())?;
        let status = self
            .instance
            .get_typed_func::<(i32, i32), i32>(&self.store, "wasmc_compile")
            .map_err(|e| e.to_string())?
            .call(&mut self.store, (pointer, source.len() as i32))
            .map_err(|e| e.to_string())?;
        Ok((
            status,
            self.copy(if status == 0 { "output" } else { "error" })?,
        ))
    }
}
