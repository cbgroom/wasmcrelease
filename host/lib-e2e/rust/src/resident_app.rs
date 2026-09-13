use crate::resident_sum::ResidentSum;
use wasmi::{Caller, Config, Engine, Error, Linker, Module, Store, TypedFunc};
struct State {
    lib: ResidentSum,
    input: Vec<u8>,
    lib_calls: usize,
}
/// Exclusive reviewed resident App -> Lib chain. Trap poisons, no replay.
pub struct ResidentApp {
    store: Store<State>,
    run: TypedFunc<(i32, i32), i64>,
    poisoned: bool,
}
impl ResidentApp {
    pub fn new(lib_path: &str, app_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let lib = ResidentSum::new(lib_path)?;
        let mut config = Config::default();
        config.consume_fuel(true);
        let engine = Engine::new(&config);
        let module = Module::new(&engine, std::fs::read(app_path)?)?;
        let mut linker = Linker::new(&engine);
        linker.func_wrap(
            "transport",
            "sum_window",
            |mut caller: Caller<'_, State>, length: i32| -> Result<i64, Error> {
                let state = caller.data_mut();
                if length as usize != state.input.len() {
                    return Err(Error::new("length drift"));
                }
                state.lib_calls += 1;
                state
                    .lib
                    .call(&state.input)
                    .map_err(|e| Error::new(e.to_string()))
            },
        )?;
        let mut store = Store::new(
            &engine,
            State {
                lib,
                input: Vec::with_capacity(16),
                lib_calls: 0,
            },
        );
        store.set_fuel(100_000)?;
        let app = linker.instantiate_and_start(&mut store, &module)?;
        let run = app.get_typed_func::<(i32, i32), i64>(&store, "run")?;
        Ok(Self {
            store,
            run,
            poisoned: false,
        })
    }
    pub fn call(&mut self, bytes: &[u8], fail: i32) -> Result<i64, Box<dyn std::error::Error>> {
        if self.poisoned || bytes.len() > 16 || !(0..=1).contains(&fail) {
            return Err("poisoned or input budget".into());
        }
        self.poisoned = true;
        let state = self.store.data_mut();
        state.input.clear();
        state.input.extend_from_slice(bytes);
        self.store.set_fuel(100_000)?;
        let result = self.run.call(&mut self.store, (bytes.len() as i32, fail))?;
        self.poisoned = false;
        Ok(result)
    }
    pub fn lib_calls(&self) -> usize {
        self.store.data().lib_calls
    }
}
