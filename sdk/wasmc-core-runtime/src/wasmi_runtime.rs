//! Opt-in Wasmi execution for immediate import-free Core Wasm completion.
//!
//! This adapter deliberately owns only reviewed, no-import Core modules. It
//! shares one immutable Wasmi [`Engine`], compiles each admitted module once,
//! and creates a fresh [`Store`] and [`Instance`] for every request boundary.
//! Host imports, state migration, retries, and backend routing are separate
//! stages governed by the common runtime design contract.

use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

use wasmi::{
    Config, Engine, Instance, Linker, Module, Store, StoreLimits, StoreLimitsBuilder, TypedFunc,
    WasmParams, WasmResults,
};

use crate::{
    limits::invoke_wasmi_bounded, module_inspection::inspect_module, CoreModuleInspection,
    CoreRuntimeLimitProfile,
};

/// Shared Wasmi engine for low-latency import-free completion.
#[derive(Clone)]
pub struct WasmiCompletionRuntime {
    inner: Arc<RuntimeInner>,
}

struct RuntimeInner {
    engine: Engine,
    limits: CoreRuntimeLimitProfile,
    compile_count: AtomicU64,
    inspection_count: AtomicU64,
}

impl WasmiCompletionRuntime {
    /// Create one reusable Wasmi interpreter engine.
    pub fn new() -> Self {
        Self::new_with_limits(CoreRuntimeLimitProfile::unbounded())
    }

    pub(crate) fn new_with_limits(limits: CoreRuntimeLimitProfile) -> Self {
        let mut config = Config::default();
        config.consume_fuel(limits.is_bounded());
        Self {
            inner: Arc::new(RuntimeInner {
                engine: Engine::new(&config),
                limits,
                compile_count: AtomicU64::new(0),
                inspection_count: AtomicU64::new(0),
            }),
        }
    }

    /// Compile one already generated Core Wasm module.
    ///
    /// Imports are rejected before the module becomes executable. This v0 lane
    /// never invents or grants ambient Host authority.
    pub fn compile_wasm(&self, wasm: &[u8]) -> Result<WasmiCompletionModule, wasmi::Error> {
        let module = Module::new(&self.inner.engine, wasm)?;
        if let Some(import) = module.imports().next() {
            return Err(wasmi::Error::new(format!(
                "wasmi completion profile rejects import {}.{}; use an explicit host runner",
                import.module(),
                import.name()
            )));
        }
        self.inner.compile_count.fetch_add(1, Ordering::Relaxed);
        Ok(WasmiCompletionModule {
            runtime: self.clone(),
            module,
            wasm_bytes: wasm.len(),
        })
    }

    /// Number of modules successfully compiled by this shared runtime.
    pub fn compile_count(&self) -> u64 {
        self.inner.compile_count.load(Ordering::Relaxed)
    }

    /// Validate a Core module and return Host-readable shape without Wasmtime.
    pub fn inspect_wasm(&self, wasm: &[u8]) -> Result<CoreModuleInspection, wasmi::Error> {
        let module = Module::new(&self.inner.engine, wasm)?;
        self.inner.inspection_count.fetch_add(1, Ordering::Relaxed);
        Ok(inspect_module(&module, wasm.len()))
    }

    /// Number of successful engine-neutral module inspections.
    pub fn inspection_count(&self) -> u64 {
        self.inner.inspection_count.load(Ordering::Relaxed)
    }

    pub(crate) fn engine(&self) -> &Engine {
        &self.inner.engine
    }

    #[cfg(feature = "wasmtime-runtime")]
    pub(crate) fn record_compile(&self) {
        self.inner.compile_count.fetch_add(1, Ordering::Relaxed);
    }

    pub(crate) fn limits(&self) -> CoreRuntimeLimitProfile {
        self.inner.limits
    }
}

impl Default for WasmiCompletionRuntime {
    fn default() -> Self {
        Self::new()
    }
}

/// One compiled, import-free module ready for fresh request instantiation.
pub struct WasmiCompletionModule {
    runtime: WasmiCompletionRuntime,
    module: Module,
    wasm_bytes: usize,
}

impl WasmiCompletionModule {
    /// Size of the exact input Core Wasm artifact.
    pub const fn wasm_bytes(&self) -> usize {
        self.wasm_bytes
    }

    /// Create a fresh request-local Store and Instance.
    pub fn instantiate(&self) -> Result<WasmiCompletionInstance, wasmi::Error> {
        let mut store = new_store(&self.runtime)?;
        let linker = Linker::<WasmiStoreData>::new(&self.runtime.inner.engine);
        let instance = linker.instantiate_and_start(&mut store, &self.module)?;
        Ok(WasmiCompletionInstance {
            store,
            instance,
            limits: self.runtime.limits(),
        })
    }

    /// Convenience path for a one-call request with the common `i32 -> i32` ABI.
    pub fn invoke_i32(&self, export: &str, argument: i32) -> Result<i32, wasmi::Error> {
        let mut instance = self.instantiate()?;
        instance.call_i32(export, argument)
    }
}

/// A request-local Wasmi Store and Instance.
///
/// Keep this value inside one request boundary. Resolve a typed export once and
/// reuse it for repeated calls only while the request-local instance is owned.
pub struct WasmiCompletionInstance {
    store: Store<WasmiStoreData>,
    instance: Instance,
    limits: CoreRuntimeLimitProfile,
}

struct WasmiStoreData {
    limits: StoreLimits,
}

fn new_store(runtime: &WasmiCompletionRuntime) -> Result<Store<WasmiStoreData>, wasmi::Error> {
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
    let mut store = Store::new(runtime.engine(), WasmiStoreData { limits });
    if profile.is_bounded() {
        store.limiter(|data| &mut data.limits);
        store.set_fuel(profile.wasmi_fuel())?;
    }
    Ok(store)
}

impl WasmiCompletionInstance {
    /// Resolve an export with Wasmi's statically checked Core signature.
    pub fn typed_func<Params, Results>(
        &self,
        export: &str,
    ) -> Result<TypedFunc<Params, Results>, wasmi::Error>
    where
        Params: WasmParams,
        Results: WasmResults,
    {
        self.instance
            .get_typed_func::<Params, Results>(&self.store, export)
    }

    /// Call a previously resolved typed function on this request-local Store.
    pub fn call_typed<Params, Results>(
        &mut self,
        function: &TypedFunc<Params, Results>,
        params: Params,
    ) -> Result<Results, wasmi::Error>
    where
        Params: WasmParams,
        Results: WasmResults,
    {
        function.call(&mut self.store, params)
    }

    /// Resolve and invoke the common `i32 -> i32` export shape.
    pub fn call_i32(&mut self, export: &str, argument: i32) -> Result<i32, wasmi::Error> {
        let function = self
            .instance
            .get_func(&self.store, export)
            .ok_or_else(|| wasmi::Error::new(format!("missing export `{export}`")))?;
        let inputs = [wasmi::Val::I32(argument)];
        let mut outputs = [wasmi::Val::I32(0)];
        invoke_wasmi_bounded(
            &mut self.store,
            &function,
            &inputs,
            &mut outputs,
            self.limits,
        )?;
        match outputs[0] {
            wasmi::Val::I32(value) => Ok(value),
            _ => Err(wasmi::Error::new("export result is not i32")),
        }
    }
}
