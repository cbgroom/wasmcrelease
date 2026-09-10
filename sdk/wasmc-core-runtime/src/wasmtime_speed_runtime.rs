//! Reusable Wasmtime speed path with fresh invocation-local Stores.

use std::{
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
    thread::{self, JoinHandle},
    time::Duration,
};

use wasmtime::{
    Engine, Instance, InstancePre, Linker, Module, OptLevel, Store, StoreLimits,
    StoreLimitsBuilder, TypedFunc, Val, WasmParams, WasmResults,
};

use crate::{limits::EPOCH_TICK_NS, CoreRuntimeLimitProfile};

#[derive(Clone)]
pub struct WasmtimeSpeedRuntime {
    inner: Arc<RuntimeInner>,
}

struct RuntimeInner {
    engine: Engine,
    limits: CoreRuntimeLimitProfile,
    _epoch_ticker: Option<EpochTicker>,
    compile_count: AtomicU64,
}

impl WasmtimeSpeedRuntime {
    pub fn new() -> wasmtime::Result<Self> {
        Self::new_with_limits(CoreRuntimeLimitProfile::unbounded())
    }

    pub(crate) fn new_with_limits(limits: CoreRuntimeLimitProfile) -> wasmtime::Result<Self> {
        let mut config = wasmtime::Config::new();
        config.cranelift_opt_level(OptLevel::Speed);
        config.consume_fuel(limits.is_bounded());
        config.epoch_interruption(limits.is_bounded());
        let engine = Engine::new(&config)?;
        let epoch_ticker = if limits.is_bounded() {
            Some(EpochTicker::start(engine.clone())?)
        } else {
            None
        };
        Ok(Self {
            inner: Arc::new(RuntimeInner {
                engine,
                limits,
                _epoch_ticker: epoch_ticker,
                compile_count: AtomicU64::new(0),
            }),
        })
    }

    pub fn compile_wasm(&self, wasm: &[u8]) -> wasmtime::Result<WasmtimeSpeedModule> {
        let module = Module::new(&self.inner.engine, wasm)?;
        if let Some(import) = module.imports().next() {
            return Err(wasmtime::Error::msg(format!(
                "wasmtime speed profile rejects import {}.{}; use an explicit host runner",
                import.module(),
                import.name()
            )));
        }
        let linker = Linker::<WasmtimeStoreData>::new(&self.inner.engine);
        let instance_pre = linker.instantiate_pre(&module)?;
        self.inner.compile_count.fetch_add(1, Ordering::Relaxed);
        Ok(WasmtimeSpeedModule {
            runtime: self.clone(),
            instance_pre,
            wasm_bytes: wasm.len(),
        })
    }

    pub fn compile_count(&self) -> u64 {
        self.inner.compile_count.load(Ordering::Relaxed)
    }

    pub(crate) fn engine(&self) -> &Engine {
        &self.inner.engine
    }

    #[cfg(feature = "wasmi-runtime")]
    pub(crate) fn record_compile(&self) {
        self.inner.compile_count.fetch_add(1, Ordering::Relaxed);
    }

    pub(crate) fn limits(&self) -> CoreRuntimeLimitProfile {
        self.inner.limits
    }
}

struct EpochTicker {
    stop: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
}

impl EpochTicker {
    fn start(engine: Engine) -> wasmtime::Result<Self> {
        let stop = Arc::new(AtomicBool::new(false));
        let worker_stop = Arc::clone(&stop);
        let worker = thread::Builder::new()
            .name("wasmc-wasmtime-epoch".to_string())
            .spawn(move || {
                while !worker_stop.load(Ordering::Acquire) {
                    thread::sleep(Duration::from_nanos(EPOCH_TICK_NS));
                    engine.increment_epoch();
                }
            })
            .map_err(|error| wasmtime::Error::msg(format!("start epoch ticker: {error}")))?;
        Ok(Self {
            stop,
            worker: Some(worker),
        })
    }
}

impl Drop for EpochTicker {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

impl Default for WasmtimeSpeedRuntime {
    fn default() -> Self {
        Self::new().expect("default Wasmtime speed configuration must be valid")
    }
}

#[derive(Clone)]
pub struct WasmtimeSpeedModule {
    runtime: WasmtimeSpeedRuntime,
    instance_pre: InstancePre<WasmtimeStoreData>,
    wasm_bytes: usize,
}

impl WasmtimeSpeedModule {
    pub const fn wasm_bytes(&self) -> usize {
        self.wasm_bytes
    }

    pub fn instantiate(&self) -> wasmtime::Result<WasmtimeSpeedInstance> {
        let mut store = new_store(&self.runtime)?;
        let instance = self.instance_pre.instantiate(&mut store)?;
        Ok(WasmtimeSpeedInstance { store, instance })
    }

    pub fn invoke_i32(&self, export: &str, argument: i32) -> wasmtime::Result<i32> {
        let mut instance = self.instantiate()?;
        instance.call_i32(export, argument)
    }
}

pub struct WasmtimeSpeedInstance {
    store: Store<WasmtimeStoreData>,
    instance: Instance,
}

struct WasmtimeStoreData {
    limits: StoreLimits,
}

fn new_store(runtime: &WasmtimeSpeedRuntime) -> wasmtime::Result<Store<WasmtimeStoreData>> {
    let profile = runtime.limits();
    let limits = if profile.is_bounded() {
        StoreLimitsBuilder::new()
            .memory_size(profile.max_memory_bytes())
            .table_elements(profile.max_table_elements())
            .trap_on_grow_failure(true)
            .build()
    } else {
        StoreLimitsBuilder::new().build()
    };
    let mut store = Store::new(runtime.engine(), WasmtimeStoreData { limits });
    if profile.is_bounded() {
        store.limiter(|data| &mut data.limits);
        store.set_fuel(profile.wasmtime_fuel())?;
        store.set_epoch_deadline(profile.wasmtime_deadline_ticks());
    }
    Ok(store)
}

impl WasmtimeSpeedInstance {
    pub fn call_values(&mut self, export: &str, params: &[Val]) -> wasmtime::Result<Vec<Val>> {
        let function = self
            .instance
            .get_func(&mut self.store, export)
            .ok_or_else(|| wasmtime::Error::msg(format!("missing export `{export}`")))?;
        let ty = function.ty(&self.store);
        let mut results = ty
            .results()
            .map(|ty| {
                Val::default_for_ty(&ty).ok_or_else(|| {
                    wasmtime::Error::msg(format!(
                        "unsupported result type `{ty}` for export `{export}`"
                    ))
                })
            })
            .collect::<wasmtime::Result<Vec<_>>>()?;
        function.call(&mut self.store, params, &mut results)?;
        Ok(results)
    }

    pub fn typed_func<Params, Results>(
        &mut self,
        export: &str,
    ) -> wasmtime::Result<TypedFunc<Params, Results>>
    where
        Params: WasmParams,
        Results: WasmResults,
    {
        self.instance
            .get_typed_func::<Params, Results>(&mut self.store, export)
    }

    pub fn call_typed<Params, Results>(
        &mut self,
        function: &TypedFunc<Params, Results>,
        params: Params,
    ) -> wasmtime::Result<Results>
    where
        Params: WasmParams,
        Results: WasmResults,
    {
        function.call(&mut self.store, params)
    }

    pub fn call_i32(&mut self, export: &str, argument: i32) -> wasmtime::Result<i32> {
        let function = self.typed_func::<i32, i32>(export)?;
        self.call_typed(&function, argument)
    }
}
