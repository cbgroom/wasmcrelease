//! Restricted synchronous S1 profile. Not a v1 resource/Future SDK.
use std::time::Instant;

struct Source {
    mode: String,
    start: Instant,
    clocks: usize,
    fills: usize,
    sums: usize,
    nonce: [u8; 16],
}
impl Source {
    fn new(mode: &str) -> Self {
        Self {
            mode: mode.into(),
            start: Instant::now(),
            clocks: 0,
            fills: 0,
            sums: 0,
            nonce: [0; 16],
        }
    }
    fn check(&self) -> Result<(), &'static str> {
        if self.mode == "denied" {
            Err("permission-denied")
        } else {
            Ok(())
        }
    }
    fn clock(&mut self) -> Result<i64, &'static str> {
        self.check()?;
        if self.clocks == 2 {
            return Err("limit");
        }
        let value = if self.mode == "oracle" {
            100 + self.clocks as i64
        } else {
            i64::try_from(self.start.elapsed().as_micros()).map_err(|_| "limit")?
        };
        self.clocks += 1;
        Ok(value)
    }
    fn fill(&mut self) -> Result<i32, &'static str> {
        self.check()?;
        if self.mode == "unsupported" {
            return Err("unsupported");
        }
        if self.fills != 0 {
            return Err("busy");
        }
        if self.mode == "oracle" {
            for (i, byte) in self.nonce.iter_mut().enumerate() {
                *byte = i as u8;
            }
        } else {
            getrandom::fill(&mut self.nonce).map_err(|_| "external-failure")?;
        }
        self.fills += 1;
        Ok(16)
    }
    fn sum_input(&mut self) -> Result<[u8; 16], &'static str> {
        self.check()?;
        if self.fills != 1 || self.sums != 0 {
            return Err("busy");
        }
        self.sums += 1;
        Ok(self.nonce)
    }
}
impl Drop for Source {
    fn drop(&mut self) {
        self.nonce.fill(0);
    }
}

// Same binding and Lib lifecycle for both engines; only engine API differs.
macro_rules! backend {
    ($name:ident, $backend:ident, $engine:expr, $instantiate:ident, $error:path) => {
        mod $name {
            use super::Source;
            use $backend::{Caller, Config, Engine, Linker, Memory, Module, Store, TypedFunc};
            struct Lib {
                store: Store<()>, memory: Memory, ptr: i32,
                alloc: TypedFunc<(i32,i32,i32,i32),i32>,
                sum: TypedFunc<(i32,i32),i64>,
            }
            impl Lib {
                fn new(engine: &Engine, path: &str) -> Result<Self, Box<dyn std::error::Error>> {
                    let module = Module::new(engine, std::fs::read(path)?)?;
                    let mut store = Store::new(engine, ()); store.set_fuel(100_000)?;
                    let instance = Linker::new(engine).$instantiate(&mut store, &module)?;
                    let alloc = instance.get_typed_func::<(i32,i32,i32,i32),i32>(&mut store, "cabi_realloc")?;
                    let sum = instance.get_typed_func::<(i32,i32),i64>(&mut store, "sum-s32")?;
                    let memory = instance.get_memory(&mut store, "memory").ok_or("memory missing")?;
                    let ptr = alloc.call(&mut store, (0,0,4,64))?;
                    Ok(Self { store, memory, ptr, alloc, sum })
                }
                fn call(&mut self, input: &[u8;16]) -> Result<i64, $backend::Error> {
                    self.store.set_fuel(100_000)?;
                    let mut packed = [0u8;64];
                    for (i,b) in input.iter().enumerate() { packed[4*i..4*i+4].copy_from_slice(&i32::from(*b).to_le_bytes()); }
                    self.memory.write(&mut self.store, self.ptr as usize, &packed).map_err(|_| $error("bounds"))?;
                    self.sum.call(&mut self.store, (self.ptr,16))
                }
                fn clear(&mut self) -> Result<(), Box<dyn std::error::Error>> {
                    self.memory.write(&mut self.store, self.ptr as usize, &[0;64])?;
                    self.store.set_fuel(100_000)?;
                    self.alloc.call(&mut self.store, (self.ptr,64,4,0))?;
                    Ok(())
                }
            }
            struct State { source: Source, lib: Lib }
            pub fn run(app: &str, lib: &str, mode: &str) -> Result<(), Box<dyn std::error::Error>> {
                let mut config = Config::default(); config.consume_fuel(true);
                let engine = ($engine)(&config)?;
                let lib = Lib::new(&engine, lib)?;
                let module = Module::new(&engine, std::fs::read(app)?)?;
                let mut linker = Linker::new(&engine);
                linker.func_wrap("environment", "clock_read", |mut c: Caller<'_,State>| -> Result<i64,$backend::Error> {
                    c.data_mut().source.clock().map_err($error)
                })?;
                linker.func_wrap("environment", "entropy_fill", |mut c: Caller<'_,State>| -> Result<i32,$backend::Error> {
                    c.data_mut().source.fill().map_err($error)
                })?;
                linker.func_wrap("environment", "nonce_sum", |mut c: Caller<'_,State>| -> Result<i64,$backend::Error> {
                    let input = c.data_mut().source.sum_input().map_err($error)?;
                    c.data_mut().lib.call(&input)
                })?;
                let mut store = Store::new(&engine, State { source: Source::new(mode), lib });
                store.set_fuel(100_000)?;
                let result = (|| {
                    let instance = linker.$instantiate(&mut store, &module)?;
                    instance.get_typed_func::<(),i64>(&mut store, "run")?.call(&mut store, ())
                })();
                let state = store.data_mut();
                let expected: i64 = state.source.nonce.iter().map(|b| i64::from(*b)).sum();
                let counts = (state.source.clocks,state.source.fills,state.source.sums);
                state.source.nonce.fill(0);
                let cleanup = state.lib.clear();
                match result {
                    Ok(value) => {
                        cleanup?;
                        if value != expected || counts != (2,1,1) { return Err("result or call-count mismatch".into()); }
                        println!("{{\"accepted\":true,\"value\":{value},\"clock_reads\":2,\"entropy_fills\":1,\"lib_calls\":1,\"scratch_released\":true}}");
                    }
                    Err(error) => {
                        let expected_error = match mode { "denied" => "permission-denied", "unsupported" => "unsupported", _ => return Err(error.into()) };
                        cleanup?;
                        if !format!("{error:#}").contains(expected_error) || counts != (usize::from(mode == "unsupported"),0,0) { return Err("denial or effect-count mismatch".into()); }
                        println!("{{\"accepted\":true,\"error\":\"{expected_error}\",\"entropy_fills\":0,\"lib_calls\":0,\"scratch_released\":true}}");
                    }
                }
                Ok(())
            }
        }
    }
}
backend!(
    interpreter,
    wasmi,
    |c| Ok::<_, wasmi::Error>(Engine::new(c)),
    instantiate_and_start,
    wasmi::Error::new
);
#[cfg(feature = "wasmtime-engine")]
backend!(
    jit,
    wasmtime,
    Engine::new,
    instantiate,
    wasmtime::Error::msg
);

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 5 || !["real", "denied", "unsupported", "oracle"].contains(&args[4].as_str()) {
        return Err("usage: environment-app-reference APP LIB wasmi|wasmtime real|denied|unsupported|oracle".into());
    }
    match args[3].as_str() {
        "wasmi" => interpreter::run(&args[1], &args[2], &args[4]),
        #[cfg(feature = "wasmtime-engine")]
        "wasmtime" => jit::run(&args[1], &args[2], &args[4]),
        _ => Err("unsupported engine".into()),
    }
}
