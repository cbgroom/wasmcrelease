//! Variable-arity i32 Core Host lane shared by Wasmi and Wasmtime.
//!
//! The lane is intentionally smaller than a generic dynamic-value API. It
//! covers the pointer, length, status, and opaque-handle functions used by
//! high-performance Core ABIs while keeping engine values and business state
//! out of the public contract.

use std::{any::Any, collections::BTreeSet, error::Error, fmt, sync::Arc};

use wasmi::{
    Caller as WasmiCaller, Extern as WasmiExtern, ExternType as WasmiExternType,
    FuncType as WasmiFuncType, Instance as WasmiInstance, Linker as WasmiLinker,
    Module as WasmiModule, Store as WasmiStore, StoreLimits as WasmiStoreLimits,
    StoreLimitsBuilder as WasmiStoreLimitsBuilder, Val as WasmiVal, ValType as WasmiValType,
};
use wasmtime::{
    Extern as WasmtimeExtern, ExternType as WasmtimeExternType, FuncType as WasmtimeFuncType,
    InstancePre as WasmtimeInstancePre, Linker as WasmtimeLinker, Module as WasmtimeModule,
    Store as WasmtimeStore, StoreLimits as WasmtimeStoreLimits,
    StoreLimitsBuilder as WasmtimeStoreLimitsBuilder, Val as WasmtimeVal,
    ValType as WasmtimeValType,
};

use crate::{
    limits::{invoke_wasmi_bounded, is_resource_limit_message},
    CoreRuntimeLimitProfile, WasmiCompletionRuntime, WasmtimeSpeedRuntime,
};

const MAX_IMPORTS: usize = 32;
const MAX_PARAMS: u8 = 8;
const MEMORY_EXPORT: &str = "memory";

/// One exact imported function in the i32 lane.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct I32LaneHostImport {
    module: String,
    name: String,
    param_count: u8,
}

impl I32LaneHostImport {
    pub fn new(module: impl Into<String>, name: impl Into<String>, param_count: u8) -> Self {
        Self {
            module: module.into(),
            name: name.into(),
            param_count,
        }
    }

    pub fn module(&self) -> &str {
        &self.module
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub const fn param_count(&self) -> u8 {
        self.param_count
    }
}

/// Checked access to the current calling instance's exported linear memory.
///
/// Implementations never expose engine memory handles or unchecked slices.
pub trait I32LaneMemory {
    fn byte_len(&mut self) -> Result<usize, I32LaneHostError>;
    fn read(&mut self, offset: u32, destination: &mut [u8]) -> Result<(), I32LaneHostError>;
    fn write(&mut self, offset: u32, source: &[u8]) -> Result<(), I32LaneHostError>;
}

type I32LaneCallback = Box<
    dyn FnMut(&mut dyn Any, &mut dyn I32LaneMemory, &[i32]) -> Result<i32, I32LaneHostError>
        + Send
        + 'static,
>;

/// One request-local implementation of an admitted import descriptor.
pub struct I32LaneHostBinding {
    import: I32LaneHostImport,
    callback: I32LaneCallback,
}

impl I32LaneHostBinding {
    pub fn new<F>(import: I32LaneHostImport, callback: F) -> Self
    where
        F: FnMut(&mut dyn I32LaneMemory, &[i32]) -> Result<i32, I32LaneHostError> + Send + 'static,
    {
        let mut callback = callback;
        Self {
            import,
            callback: Box::new(move |_state, memory, arguments| callback(memory, arguments)),
        }
    }

    pub fn import(&self) -> &I32LaneHostImport {
        &self.import
    }
}

type I32LaneStateCallback<S> = Box<
    dyn FnMut(&mut S, &mut dyn I32LaneMemory, &[i32]) -> Result<i32, I32LaneHostError>
        + Send
        + 'static,
>;

struct I32LaneStateBinding<S> {
    import: I32LaneHostImport,
    callback: I32LaneStateCallback<S>,
}

/// A fresh invocation's shared typed Host state and exact binding set.
///
/// Every callback receives exclusive access to the same `S`. The session is
/// consumed into one Store and therefore needs no cross-request synchronization.
pub struct I32LaneHostSession<S> {
    state: S,
    bindings: Vec<I32LaneStateBinding<S>>,
}

impl<S> I32LaneHostSession<S>
where
    S: Send + 'static,
{
    pub fn new(state: S) -> Self {
        Self {
            state,
            bindings: Vec::new(),
        }
    }

    pub fn bind<F>(mut self, import: I32LaneHostImport, callback: F) -> Self
    where
        F: FnMut(&mut S, &mut dyn I32LaneMemory, &[i32]) -> Result<i32, I32LaneHostError>
            + Send
            + 'static,
    {
        self.bindings.push(I32LaneStateBinding {
            import,
            callback: Box::new(callback),
        });
        self
    }

    pub fn binding_count(&self) -> usize {
        self.bindings.len()
    }

    pub(crate) fn erase(self) -> ErasedLaneSession {
        let bindings = self
            .bindings
            .into_iter()
            .map(|binding| {
                let mut callback = binding.callback;
                I32LaneHostBinding {
                    import: binding.import,
                    callback: Box::new(move |state, memory, arguments| {
                        let state = state.downcast_mut::<S>().ok_or_else(|| {
                            I32LaneHostError::callback("i32-lane Host state type mismatch")
                        })?;
                        callback(state, memory, arguments)
                    }),
                }
            })
            .collect();
        ErasedLaneSession {
            state: Box::new(self.state),
            bindings,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum I32LaneHostErrorCode {
    InvalidPlan,
    ImportMismatch,
    Compile,
    Binding,
    Invocation,
    Memory,
    Callback,
    ResourceLimit,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct I32LaneHostError {
    code: I32LaneHostErrorCode,
    message: String,
}

impl I32LaneHostError {
    fn new(code: I32LaneHostErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn callback(message: impl Into<String>) -> Self {
        Self::new(I32LaneHostErrorCode::Callback, message)
    }

    pub const fn code(&self) -> I32LaneHostErrorCode {
        self.code
    }

    pub fn message(&self) -> &str {
        &self.message
    }

    fn memory(message: impl Into<String>) -> Self {
        Self::new(I32LaneHostErrorCode::Memory, message)
    }
}

impl fmt::Display for I32LaneHostError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl Error for I32LaneHostError {}

pub(crate) struct ErasedLaneSession {
    state: Box<dyn Any + Send>,
    bindings: Vec<I32LaneHostBinding>,
}

impl ErasedLaneSession {
    pub(crate) fn stateless(bindings: Vec<I32LaneHostBinding>) -> Self {
        Self {
            state: Box::new(()),
            bindings,
        }
    }
}

struct LaneCallbacks {
    state: Option<Box<dyn Any + Send>>,
    callbacks: Vec<Option<I32LaneCallback>>,
    wasmi_limits: WasmiStoreLimits,
    wasmtime_limits: WasmtimeStoreLimits,
}

pub(crate) struct WasmiI32LaneHostModule {
    runtime: WasmiCompletionRuntime,
    module: WasmiModule,
    imports: Arc<[I32LaneHostImport]>,
}

impl WasmiI32LaneHostModule {
    pub(crate) fn compile(
        runtime: &WasmiCompletionRuntime,
        wasm: &[u8],
        reviewed: &[I32LaneHostImport],
    ) -> Result<Self, I32LaneHostError> {
        validate_plan(reviewed)?;
        let module = WasmiModule::new(runtime.engine(), wasm).map_err(|error| {
            I32LaneHostError::new(
                I32LaneHostErrorCode::Compile,
                format!("Wasmi rejected i32-lane Core module: {error}"),
            )
        })?;
        let actual = module
            .imports()
            .map(|import| {
                let WasmiExternType::Func(function) = import.ty() else {
                    return Err(I32LaneHostError::new(
                        I32LaneHostErrorCode::ImportMismatch,
                        format!(
                            "import {}.{} is not a function",
                            import.module(),
                            import.name()
                        ),
                    ));
                };
                if function.params().len() > usize::from(MAX_PARAMS)
                    || function.params().iter().any(|ty| *ty != WasmiValType::I32)
                    || function.results() != [WasmiValType::I32]
                {
                    return Err(signature_error(import.module(), import.name()));
                }
                Ok(I32LaneHostImport::new(
                    import.module(),
                    import.name(),
                    u8::try_from(function.params().len()).expect("bounded i32 lane arity"),
                ))
            })
            .collect::<Result<Vec<_>, _>>()?;
        require_exact_imports(&actual, reviewed)?;
        runtime.record_compile();
        Ok(Self {
            runtime: runtime.clone(),
            module,
            imports: Arc::from(reviewed),
        })
    }

    pub(crate) fn imports(&self) -> &[I32LaneHostImport] {
        &self.imports
    }

    pub(crate) fn invoke(
        &self,
        session: ErasedLaneSession,
        export: &str,
        arguments: &[i32],
    ) -> Result<i32, I32LaneHostError> {
        let profile = self.runtime.limits();
        let callbacks = exact_callbacks(&self.imports, session, profile)?;
        let mut linker = WasmiLinker::<LaneCallbacks>::new(self.runtime.engine());
        for (index, import) in self.imports.iter().enumerate() {
            let ty = WasmiFuncType::new(
                std::iter::repeat_n(WasmiValType::I32, usize::from(import.param_count)),
                [WasmiValType::I32],
            );
            linker
                .func_new(
                    import.module(),
                    import.name(),
                    ty,
                    move |mut caller: WasmiCaller<'_, LaneCallbacks>, params, results| {
                        let mut arguments = [0_i32; MAX_PARAMS as usize];
                        for (slot, value) in arguments.iter_mut().zip(params) {
                            *slot = match value {
                                WasmiVal::I32(value) => *value,
                                _ => return Err(wasmi::Error::new("non-i32 Host argument")),
                            };
                        }
                        let (mut state, mut callback) = {
                            let data = caller.data_mut();
                            let state = data.state.take().ok_or_else(|| {
                                wasmi::Error::new("reentrant i32-lane Host state")
                            })?;
                            let callback = data.callbacks[index].take().ok_or_else(|| {
                                wasmi::Error::new("reentrant i32-lane Host callback")
                            })?;
                            (state, callback)
                        };
                        let mut memory = WasmiLaneMemory {
                            caller: &mut caller,
                        };
                        let callback_result =
                            callback(state.as_mut(), &mut memory, &arguments[..params.len()]);
                        let data = caller.data_mut();
                        data.state = Some(state);
                        data.callbacks[index] = Some(callback);
                        let value = callback_result
                            .map_err(|error| wasmi::Error::new(error.to_string()))?;
                        results[0] = WasmiVal::I32(value);
                        Ok(())
                    },
                )
                .map_err(|error| binding_error("Wasmi", error))?;
        }
        let mut store = WasmiStore::new(self.runtime.engine(), callbacks);
        if profile.is_bounded() {
            store.limiter(|data| &mut data.wasmi_limits);
            store
                .set_fuel(profile.wasmi_fuel())
                .map_err(|error| invocation_error("Wasmi fuel setup", error))?;
        }
        let instance: WasmiInstance = linker
            .instantiate_and_start(&mut store, &self.module)
            .map_err(|error| invocation_error("Wasmi instantiation", error))?;
        let function = instance
            .get_func(&store, export)
            .ok_or_else(|| invocation_message(format!("Wasmi export {export:?} is missing")))?;
        let inputs = arguments
            .iter()
            .copied()
            .map(WasmiVal::I32)
            .collect::<Vec<_>>();
        let mut outputs = [WasmiVal::I32(0)];
        invoke_wasmi_bounded(&mut store, &function, &inputs, &mut outputs, profile)
            .map_err(|error| invocation_error("Wasmi call", error))?;
        match outputs[0] {
            WasmiVal::I32(value) => Ok(value),
            _ => Err(invocation_message("Wasmi export result is not i32")),
        }
    }
}

struct WasmiLaneMemory<'a, 'b> {
    caller: &'a mut WasmiCaller<'b, LaneCallbacks>,
}

impl I32LaneMemory for WasmiLaneMemory<'_, '_> {
    fn byte_len(&mut self) -> Result<usize, I32LaneHostError> {
        let memory = wasmi_memory(self.caller)?;
        Ok(memory.data_size(&*self.caller))
    }

    fn read(&mut self, offset: u32, destination: &mut [u8]) -> Result<(), I32LaneHostError> {
        let memory = wasmi_memory(self.caller)?;
        memory
            .read(&*self.caller, offset as usize, destination)
            .map_err(|error| I32LaneHostError::memory(format!("Wasmi memory read failed: {error}")))
    }

    fn write(&mut self, offset: u32, source: &[u8]) -> Result<(), I32LaneHostError> {
        let memory = wasmi_memory(self.caller)?;
        memory
            .write(&mut *self.caller, offset as usize, source)
            .map_err(|error| {
                I32LaneHostError::memory(format!("Wasmi memory write failed: {error}"))
            })
    }
}

fn wasmi_memory(
    caller: &WasmiCaller<'_, LaneCallbacks>,
) -> Result<wasmi::Memory, I32LaneHostError> {
    match caller.get_export(MEMORY_EXPORT) {
        Some(WasmiExtern::Memory(memory)) => Ok(memory),
        _ => Err(I32LaneHostError::memory(
            "calling Core instance exports no linear memory named memory",
        )),
    }
}

pub(crate) struct WasmtimeI32LaneHostModule {
    runtime: WasmtimeSpeedRuntime,
    instance_pre: WasmtimeInstancePre<LaneCallbacks>,
    imports: Arc<[I32LaneHostImport]>,
}

impl WasmtimeI32LaneHostModule {
    pub(crate) fn compile(
        runtime: &WasmtimeSpeedRuntime,
        wasm: &[u8],
        reviewed: &[I32LaneHostImport],
    ) -> Result<Self, I32LaneHostError> {
        validate_plan(reviewed)?;
        let module = WasmtimeModule::new(runtime.engine(), wasm).map_err(|error| {
            I32LaneHostError::new(
                I32LaneHostErrorCode::Compile,
                format!("Wasmtime rejected i32-lane Core module: {error}"),
            )
        })?;
        let actual = module
            .imports()
            .map(|import| {
                let WasmtimeExternType::Func(function) = import.ty() else {
                    return Err(I32LaneHostError::new(
                        I32LaneHostErrorCode::ImportMismatch,
                        format!(
                            "import {}.{} is not a function",
                            import.module(),
                            import.name()
                        ),
                    ));
                };
                let params = function.params().collect::<Vec<_>>();
                let results = function.results().collect::<Vec<_>>();
                if params.len() > usize::from(MAX_PARAMS)
                    || params.iter().any(|ty| !matches!(ty, WasmtimeValType::I32))
                    || results.len() != 1
                    || !matches!(results.first(), Some(WasmtimeValType::I32))
                {
                    return Err(signature_error(import.module(), import.name()));
                }
                Ok(I32LaneHostImport::new(
                    import.module(),
                    import.name(),
                    u8::try_from(params.len()).expect("bounded i32 lane arity"),
                ))
            })
            .collect::<Result<Vec<_>, _>>()?;
        require_exact_imports(&actual, reviewed)?;

        let mut linker = WasmtimeLinker::<LaneCallbacks>::new(runtime.engine());
        for (index, import) in reviewed.iter().enumerate() {
            let ty = WasmtimeFuncType::new(
                runtime.engine(),
                std::iter::repeat_n(WasmtimeValType::I32, usize::from(import.param_count)),
                [WasmtimeValType::I32],
            );
            linker
                .func_new(
                    import.module(),
                    import.name(),
                    ty,
                    move |mut caller, params, results| {
                        let mut arguments = [0_i32; MAX_PARAMS as usize];
                        for (slot, value) in arguments.iter_mut().zip(params) {
                            *slot = match value {
                                WasmtimeVal::I32(value) => *value,
                                _ => return Err(wasmtime::Error::msg("non-i32 Host argument")),
                            };
                        }
                        let (mut state, mut callback) = {
                            let data = caller.data_mut();
                            let state = data.state.take().ok_or_else(|| {
                                wasmtime::Error::msg("reentrant i32-lane Host state")
                            })?;
                            let callback = data.callbacks[index].take().ok_or_else(|| {
                                wasmtime::Error::msg("reentrant i32-lane Host callback")
                            })?;
                            (state, callback)
                        };
                        let mut memory = WasmtimeLaneMemory {
                            caller: &mut caller,
                        };
                        let callback_result =
                            callback(state.as_mut(), &mut memory, &arguments[..params.len()]);
                        let data = caller.data_mut();
                        data.state = Some(state);
                        data.callbacks[index] = Some(callback);
                        let value = callback_result
                            .map_err(|error| wasmtime::Error::msg(error.to_string()))?;
                        results[0] = WasmtimeVal::I32(value);
                        Ok(())
                    },
                )
                .map_err(|error| binding_error("Wasmtime", error))?;
        }
        let instance_pre = linker
            .instantiate_pre(&module)
            .map_err(|error| binding_error("Wasmtime", error))?;
        runtime.record_compile();
        Ok(Self {
            runtime: runtime.clone(),
            instance_pre,
            imports: Arc::from(reviewed),
        })
    }

    pub(crate) fn invoke(
        &self,
        session: ErasedLaneSession,
        export: &str,
        arguments: &[i32],
    ) -> Result<i32, I32LaneHostError> {
        let profile = self.runtime.limits();
        let callbacks = exact_callbacks(&self.imports, session, profile)?;
        let mut store = WasmtimeStore::new(self.runtime.engine(), callbacks);
        if profile.is_bounded() {
            store.limiter(|data| &mut data.wasmtime_limits);
            store
                .set_fuel(profile.wasmtime_fuel())
                .map_err(|error| invocation_error("Wasmtime fuel setup", error))?;
            store.set_epoch_deadline(profile.wasmtime_deadline_ticks());
        }
        let instance = self
            .instance_pre
            .instantiate(&mut store)
            .map_err(|error| invocation_error("Wasmtime instantiation", format!("{error:#}")))?;
        let function = instance
            .get_func(&mut store, export)
            .ok_or_else(|| invocation_message(format!("Wasmtime export {export:?} is missing")))?;
        let inputs = arguments
            .iter()
            .copied()
            .map(WasmtimeVal::I32)
            .collect::<Vec<_>>();
        let mut outputs = [WasmtimeVal::I32(0)];
        function
            .call(&mut store, &inputs, &mut outputs)
            .map_err(|error| invocation_error("Wasmtime call", format!("{error:#}")))?;
        match outputs[0] {
            WasmtimeVal::I32(value) => Ok(value),
            _ => Err(invocation_message("Wasmtime export result is not i32")),
        }
    }
}

struct WasmtimeLaneMemory<'a, 'b> {
    caller: &'a mut wasmtime::Caller<'b, LaneCallbacks>,
}

impl I32LaneMemory for WasmtimeLaneMemory<'_, '_> {
    fn byte_len(&mut self) -> Result<usize, I32LaneHostError> {
        let memory = wasmtime_memory(self.caller)?;
        Ok(memory.data_size(&*self.caller))
    }

    fn read(&mut self, offset: u32, destination: &mut [u8]) -> Result<(), I32LaneHostError> {
        let memory = wasmtime_memory(self.caller)?;
        memory
            .read(&*self.caller, offset as usize, destination)
            .map_err(|error| {
                I32LaneHostError::memory(format!("Wasmtime memory read failed: {error}"))
            })
    }

    fn write(&mut self, offset: u32, source: &[u8]) -> Result<(), I32LaneHostError> {
        let memory = wasmtime_memory(self.caller)?;
        memory
            .write(&mut *self.caller, offset as usize, source)
            .map_err(|error| {
                I32LaneHostError::memory(format!("Wasmtime memory write failed: {error}"))
            })
    }
}

fn wasmtime_memory(
    caller: &mut wasmtime::Caller<'_, LaneCallbacks>,
) -> Result<wasmtime::Memory, I32LaneHostError> {
    match caller.get_export(MEMORY_EXPORT) {
        Some(WasmtimeExtern::Memory(memory)) => Ok(memory),
        _ => Err(I32LaneHostError::memory(
            "calling Core instance exports no linear memory named memory",
        )),
    }
}

fn validate_plan(reviewed: &[I32LaneHostImport]) -> Result<(), I32LaneHostError> {
    if reviewed.is_empty() || reviewed.len() > MAX_IMPORTS {
        return Err(I32LaneHostError::new(
            I32LaneHostErrorCode::InvalidPlan,
            format!("i32-lane Host plan must contain 1..={MAX_IMPORTS} rows"),
        ));
    }
    let mut unique = BTreeSet::new();
    for import in reviewed {
        if import.module.is_empty() || import.name.is_empty() || import.param_count > MAX_PARAMS {
            return Err(I32LaneHostError::new(
                I32LaneHostErrorCode::InvalidPlan,
                format!(
                    "invalid i32-lane Host import {}.{} with {} parameters",
                    import.module, import.name, import.param_count
                ),
            ));
        }
        if !unique.insert((import.module.as_str(), import.name.as_str())) {
            return Err(I32LaneHostError::new(
                I32LaneHostErrorCode::InvalidPlan,
                format!("duplicate Host import {}.{}", import.module, import.name),
            ));
        }
    }
    Ok(())
}

fn require_exact_imports(
    actual: &[I32LaneHostImport],
    reviewed: &[I32LaneHostImport],
) -> Result<(), I32LaneHostError> {
    if actual != reviewed {
        return Err(I32LaneHostError::new(
            I32LaneHostErrorCode::ImportMismatch,
            format!("Core imports {actual:?} do not equal reviewed i32-lane plan {reviewed:?}"),
        ));
    }
    Ok(())
}

fn exact_callbacks(
    reviewed: &[I32LaneHostImport],
    session: ErasedLaneSession,
    profile: CoreRuntimeLimitProfile,
) -> Result<LaneCallbacks, I32LaneHostError> {
    let actual = session
        .bindings
        .iter()
        .map(|binding| binding.import.clone())
        .collect::<Vec<_>>();
    require_exact_imports(&actual, reviewed)?;
    Ok(LaneCallbacks {
        state: Some(session.state),
        callbacks: session
            .bindings
            .into_iter()
            .map(|binding| Some(binding.callback))
            .collect(),
        wasmi_limits: WasmiStoreLimitsBuilder::new()
            .memory_size(profile.max_memory_bytes())
            .table_elements(profile.max_table_elements())
            .trap_on_grow_failure(true)
            .build(),
        wasmtime_limits: WasmtimeStoreLimitsBuilder::new()
            .memory_size(profile.max_memory_bytes())
            .table_elements(profile.max_table_elements())
            .trap_on_grow_failure(true)
            .build(),
    })
}

fn signature_error(module: &str, name: &str) -> I32LaneHostError {
    I32LaneHostError::new(
        I32LaneHostErrorCode::ImportMismatch,
        format!("import {module}.{name} is not 0..={MAX_PARAMS} i32 parameters -> i32"),
    )
}

fn binding_error(engine: &str, error: impl fmt::Display) -> I32LaneHostError {
    I32LaneHostError::new(
        I32LaneHostErrorCode::Binding,
        format!("{engine} i32-lane Host binding failed: {error}"),
    )
}

fn invocation_error(stage: &str, error: impl fmt::Display) -> I32LaneHostError {
    let message = error.to_string();
    I32LaneHostError::new(
        if is_resource_limit_message(&message) {
            I32LaneHostErrorCode::ResourceLimit
        } else {
            I32LaneHostErrorCode::Invocation
        },
        format!("{stage} failed: {message}"),
    )
}

fn invocation_message(message: impl Into<String>) -> I32LaneHostError {
    I32LaneHostError::new(I32LaneHostErrorCode::Invocation, message)
}
