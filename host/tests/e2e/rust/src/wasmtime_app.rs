use wasmtime::{Caller, Config, Engine, Linker, Memory, Module, Store, TypedFunc};
struct Lib {
    store: Store<()>,
    memory: Memory,
    sum: TypedFunc<(i32, i32), i64>,
    ptr: i32,
    poisoned: bool,
}
impl Lib {
    fn new(engine: &Engine, path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let module = Module::new(engine, std::fs::read(path)?)?;
        let mut store = Store::new(engine, ());
        store.set_fuel(10_000_000)?;
        let lib = Linker::new(engine).instantiate(&mut store, &module)?;
        let alloc = lib.get_typed_func::<(i32, i32, i32, i32), i32>(&mut store, "cabi_realloc")?;
        let sum = lib.get_typed_func::<(i32, i32), i64>(&mut store, "sum-s32")?;
        let memory = lib
            .get_memory(&mut store, "memory")
            .ok_or("memory missing")?;
        let ptr = alloc.call(&mut store, (0, 0, 4, 64))?;
        Ok(Self {
            store,
            memory,
            sum,
            ptr,
            poisoned: false,
        })
    }
    fn call(&mut self, input: &[u8]) -> wasmtime::Result<i64> {
        if self.poisoned {
            return Err(wasmtime::Error::msg("Lib poisoned"));
        }
        self.poisoned = true;
        self.store.set_fuel(100_000)?;
        let packed: Vec<u8> = input
            .iter()
            .flat_map(|b| i32::from(*b).to_le_bytes())
            .collect();
        self.memory
            .write(&mut self.store, self.ptr as usize, &packed)?;
        let value = self
            .sum
            .call(&mut self.store, (self.ptr, input.len() as i32))?;
        self.poisoned = false;
        Ok(value)
    }
}
struct State {
    lib: Lib,
    input: Vec<u8>,
    calls: usize,
}
pub struct WasmtimeApp {
    store: Store<State>,
    run: TypedFunc<(i32, i32), i64>,
    poisoned: bool,
}
impl WasmtimeApp {
    pub fn new(lib_path: &str, app_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let mut config = Config::new();
        config.consume_fuel(true);
        let engine = Engine::new(&config)?;
        let lib = Lib::new(&engine, lib_path)?;
        let module = Module::new(&engine, std::fs::read(app_path)?)?;
        let mut linker = Linker::new(&engine);
        linker.func_wrap(
            "transport",
            "sum_window",
            |mut caller: Caller<'_, State>, length: i32| -> wasmtime::Result<i64> {
                let state = caller.data_mut();
                if length as usize != state.input.len() {
                    return Err(wasmtime::Error::msg("length drift"));
                }
                state.calls += 1;
                state.lib.call(&state.input)
            },
        )?;
        let mut store = Store::new(
            &engine,
            State {
                lib,
                input: Vec::with_capacity(16),
                calls: 0,
            },
        );
        store.set_fuel(100_000)?;
        let app = linker.instantiate(&mut store, &module)?;
        let run = app.get_typed_func::<(i32, i32), i64>(&mut store, "run")?;
        Ok(Self {
            store,
            run,
            poisoned: false,
        })
    }
    pub fn call(&mut self, input: &[u8], fail: i32) -> Result<i64, Box<dyn std::error::Error>> {
        if self.poisoned || input.len() > 16 || !(0..=1).contains(&fail) {
            return Err("poisoned or input budget".into());
        }
        self.poisoned = true;
        let state = self.store.data_mut();
        state.input.clear();
        state.input.extend_from_slice(input);
        self.store.set_fuel(100_000)?;
        let value = self.run.call(&mut self.store, (input.len() as i32, fail))?;
        self.poisoned = false;
        Ok(value)
    }
    pub fn lib_calls(&self) -> usize {
        self.store.data().calls
    }
}
