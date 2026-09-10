//! Exact WIT/Core flat-scalar Host lane shared by Wasmi and Wasmtime.

use std::{any::Any, collections::BTreeSet, error::Error, fmt, sync::Arc};

use wasmi::{
    Caller as WasmiCaller, Extern as WasmiExtern, ExternType as WasmiExternType,
    FuncType as WasmiFuncType, Linker as WasmiLinker, Module as WasmiModule, Store as WasmiStore,
    StoreLimits as WasmiStoreLimits, StoreLimitsBuilder as WasmiStoreLimitsBuilder,
    Val as WasmiVal, ValType as WasmiValType,
};
use wasmtime::{
    Extern as WasmtimeExtern, ExternType as WasmtimeExternType, FuncType as WasmtimeFuncType,
    InstancePre as WasmtimeInstancePre, Linker as WasmtimeLinker, Module as WasmtimeModule,
    Store as WasmtimeStore, StoreLimits as WasmtimeStoreLimits,
    StoreLimitsBuilder as WasmtimeStoreLimitsBuilder, UpdateDeadline, Val as WasmtimeVal,
    ValType as WasmtimeValType,
};

use crate::{
    limits::{invoke_wasmi_bounded_with_cancellation, is_resource_limit_message},
    CoreRuntimeCancellation, CoreRuntimeLimitProfile, WasmiCompletionRuntime, WasmtimeSpeedRuntime,
};

const MAX_IMPORTS: usize = 64;
const MAX_VALUES: usize = 16;
const MEMORY_EXPORT: &str = "memory";

/// Scalar types produced by WIT canonical flattening and carried by Core Wasm.
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub enum CoreScalarType {
    I32,
    I64,
    F32,
    F64,
}

/// Engine-neutral scalar value. Float payloads preserve their exact bit pattern.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum CoreScalarValue {
    I32(i32),
    I64(i64),
    F32(u32),
    F64(u64),
}

impl CoreScalarValue {
    pub const fn value_type(self) -> CoreScalarType {
        match self {
            Self::I32(_) => CoreScalarType::I32,
            Self::I64(_) => CoreScalarType::I64,
            Self::F32(_) => CoreScalarType::F32,
            Self::F64(_) => CoreScalarType::F64,
        }
    }

    fn zero(value_type: CoreScalarType) -> Self {
        match value_type {
            CoreScalarType::I32 => Self::I32(0),
            CoreScalarType::I64 => Self::I64(0),
            CoreScalarType::F32 => Self::F32(0),
            CoreScalarType::F64 => Self::F64(0),
        }
    }
}

/// One exact imported Core function after WIT flattening.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct CoreScalarHostImport {
    module: String,
    name: String,
    params: Vec<CoreScalarType>,
    results: Vec<CoreScalarType>,
}

impl CoreScalarHostImport {
    pub fn new(
        module: impl Into<String>,
        name: impl Into<String>,
        params: impl Into<Vec<CoreScalarType>>,
        results: impl Into<Vec<CoreScalarType>>,
    ) -> Self {
        Self {
            module: module.into(),
            name: name.into(),
            params: params.into(),
            results: results.into(),
        }
    }

    pub fn module(&self) -> &str {
        &self.module
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn params(&self) -> &[CoreScalarType] {
        &self.params
    }

    pub fn results(&self) -> &[CoreScalarType] {
        &self.results
    }
}

/// Checked access to the calling instance's exported linear memory.
pub trait CoreScalarMemory {
    fn byte_len(&mut self) -> Result<usize, CoreScalarHostError>;
    fn read(&mut self, offset: u32, destination: &mut [u8]) -> Result<(), CoreScalarHostError>;
    fn write(&mut self, offset: u32, source: &[u8]) -> Result<(), CoreScalarHostError>;
}

type ScalarCallback = Box<
    dyn FnMut(
            &mut dyn Any,
            &mut dyn CoreScalarMemory,
            &[CoreScalarValue],
        ) -> Result<Vec<CoreScalarValue>, CoreScalarHostError>
        + Send
        + 'static,
>;

type StateCallback<S> = Box<
    dyn FnMut(
            &mut S,
            &mut dyn CoreScalarMemory,
            &[CoreScalarValue],
        ) -> Result<Vec<CoreScalarValue>, CoreScalarHostError>
        + Send
        + 'static,
>;

struct StateBinding<S> {
    import: CoreScalarHostImport,
    callback: StateCallback<S>,
}

/// A fresh invocation's typed state and exact ordered scalar binding set.
pub struct CoreScalarHostSession<S> {
    state: S,
    bindings: Vec<StateBinding<S>>,
}

impl<S> CoreScalarHostSession<S>
where
    S: Send + 'static,
{
    pub fn new(state: S) -> Self {
        Self {
            state,
            bindings: Vec::new(),
        }
    }

    pub fn bind<F>(mut self, import: CoreScalarHostImport, callback: F) -> Self
    where
        F: FnMut(
                &mut S,
                &mut dyn CoreScalarMemory,
                &[CoreScalarValue],
            ) -> Result<Vec<CoreScalarValue>, CoreScalarHostError>
            + Send
            + 'static,
    {
        self.bindings.push(StateBinding {
            import,
            callback: Box::new(callback),
        });
        self
    }

    pub fn binding_count(&self) -> usize {
        self.bindings.len()
    }

    pub(crate) fn erase(self) -> ErasedScalarSession {
        let bindings = self
            .bindings
            .into_iter()
            .map(|binding| {
                let mut callback = binding.callback;
                ScalarBinding {
                    import: binding.import,
                    callback: Box::new(move |state, memory, arguments| {
                        let state = state.downcast_mut::<S>().ok_or_else(|| {
                            CoreScalarHostError::callback("scalar Host state type mismatch")
                        })?;
                        callback(state, memory, arguments)
                    }),
                }
            })
            .collect();
        ErasedScalarSession {
            state: Box::new(self.state),
            bindings,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CoreScalarHostErrorCode {
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
pub struct CoreScalarHostError {
    code: CoreScalarHostErrorCode,
    message: String,
}

impl CoreScalarHostError {
    fn new(code: CoreScalarHostErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn callback(message: impl Into<String>) -> Self {
        Self::new(CoreScalarHostErrorCode::Callback, message)
    }

    pub const fn code(&self) -> CoreScalarHostErrorCode {
        self.code
    }

    pub fn message(&self) -> &str {
        &self.message
    }

    fn memory(message: impl Into<String>) -> Self {
        Self::new(CoreScalarHostErrorCode::Memory, message)
    }
}

impl fmt::Display for CoreScalarHostError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl Error for CoreScalarHostError {}

struct ScalarBinding {
    import: CoreScalarHostImport,
    callback: ScalarCallback,
}

pub(crate) struct ErasedScalarSession {
    state: Box<dyn Any + Send>,
    bindings: Vec<ScalarBinding>,
}

impl ErasedScalarSession {
    pub(crate) fn into_state<S>(self) -> S
    where
        S: Send + 'static,
    {
        *self
            .state
            .downcast::<S>()
            .expect("erased scalar Host state must preserve its concrete type")
    }
}

pub(crate) struct ErasedScalarOutcome {
    pub(crate) result: Result<Vec<CoreScalarValue>, CoreScalarHostError>,
    state: Box<dyn Any + Send>,
}

impl ErasedScalarOutcome {
    pub(crate) fn into_typed<S>(self) -> (Result<Vec<CoreScalarValue>, CoreScalarHostError>, S)
    where
        S: Send + 'static,
    {
        (
            self.result,
            *self
                .state
                .downcast::<S>()
                .expect("erased scalar Host state must preserve its concrete type"),
        )
    }
}

struct ScalarCallbacks {
    state: Option<Box<dyn Any + Send>>,
    callbacks: Vec<Option<ScalarCallback>>,
    wasmi_limits: WasmiStoreLimits,
    wasmtime_limits: WasmtimeStoreLimits,
}

pub(crate) struct WasmiScalarHostModule {
    runtime: WasmiCompletionRuntime,
    module: WasmiModule,
    imports: Arc<[CoreScalarHostImport]>,
}

impl WasmiScalarHostModule {
    pub(crate) fn compile(
        runtime: &WasmiCompletionRuntime,
        wasm: &[u8],
        reviewed: &[CoreScalarHostImport],
    ) -> Result<Self, CoreScalarHostError> {
        validate_plan(reviewed)?;
        let module = WasmiModule::new(runtime.engine(), wasm).map_err(|error| {
            CoreScalarHostError::new(
                CoreScalarHostErrorCode::Compile,
                format!("Wasmi rejected scalar Core module: {error}"),
            )
        })?;
        let actual = module
            .imports()
            .map(|import| {
                let WasmiExternType::Func(function) = import.ty() else {
                    return Err(import_kind_error(import.module(), import.name()));
                };
                let params = function
                    .params()
                    .iter()
                    .copied()
                    .map(core_type_from_wasmi)
                    .collect::<Result<Vec<_>, _>>()?;
                let results = function
                    .results()
                    .iter()
                    .copied()
                    .map(core_type_from_wasmi)
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(CoreScalarHostImport::new(
                    import.module(),
                    import.name(),
                    params,
                    results,
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

    pub(crate) fn imports(&self) -> &[CoreScalarHostImport] {
        &self.imports
    }

    pub(crate) fn invoke_with_state(
        &self,
        session: ErasedScalarSession,
        export: &str,
        arguments: &[CoreScalarValue],
        cancellation: &CoreRuntimeCancellation,
    ) -> ErasedScalarOutcome {
        let state_on_error = |error, session: ErasedScalarSession| ErasedScalarOutcome {
            result: Err(error),
            state: session.state,
        };
        if let Err(error) = validate_call_shape(arguments) {
            return state_on_error(error, session);
        }
        let actual = session
            .bindings
            .iter()
            .map(|binding| binding.import.clone())
            .collect::<Vec<_>>();
        if let Err(error) = require_exact_imports(&actual, &self.imports) {
            return state_on_error(error, session);
        }
        let profile = self.runtime.limits();
        let mut callbacks = exact_callbacks(session, profile);
        let mut linker = WasmiLinker::<ScalarCallbacks>::new(self.runtime.engine());
        for (index, import) in self.imports.iter().enumerate() {
            let expected_results = import.results.clone();
            let ty = WasmiFuncType::new(
                import.params.iter().copied().map(wasmi_type),
                import.results.iter().copied().map(wasmi_type),
            );
            if let Err(error) = linker.func_new(
                import.module(),
                import.name(),
                ty,
                move |mut caller: WasmiCaller<'_, ScalarCallbacks>, params, results| {
                    let arguments = params
                        .iter()
                        .map(core_value_from_wasmi)
                        .collect::<Result<Vec<_>, _>>()?;
                    let returned = invoke_callback(&mut caller, index, &arguments)
                        .map_err(|error| wasmi::Error::new(error.to_string()))?;
                    if returned.len() != results.len() {
                        return Err(wasmi::Error::new("scalar Host result arity mismatch"));
                    }
                    require_value_types(&returned, &expected_results)
                        .map_err(|error| wasmi::Error::new(error.to_string()))?;
                    for (slot, value) in results.iter_mut().zip(returned) {
                        *slot = wasmi_value(value);
                    }
                    Ok(())
                },
            ) {
                return ErasedScalarOutcome {
                    result: Err(binding_error("Wasmi", error)),
                    state: callbacks
                        .state
                        .take()
                        .expect("scalar Host state must be available before Store creation"),
                };
            }
        }
        let mut store = WasmiStore::new(self.runtime.engine(), callbacks);
        if profile.is_bounded() {
            store.limiter(|data| &mut data.wasmi_limits);
            if let Err(error) = store.set_fuel(profile.wasmi_fuel()) {
                let state = store
                    .into_data()
                    .state
                    .expect("scalar Host state must exist after fuel setup failure");
                return ErasedScalarOutcome {
                    result: Err(invocation_error("Wasmi fuel setup", error)),
                    state,
                };
            }
        }
        let result = (|| {
            let instance = linker
                .instantiate_and_start(&mut store, &self.module)
                .map_err(|error| invocation_error("Wasmi instantiation", error))?;
            let function = instance
                .get_func(&store, export)
                .ok_or_else(|| invocation_message(format!("Wasmi export {export:?} is missing")))?;
            let result_types = function
                .ty(&store)
                .results()
                .iter()
                .copied()
                .map(core_type_from_wasmi)
                .collect::<Result<Vec<_>, _>>()?;
            validate_result_shape(&result_types)?;
            let inputs = arguments
                .iter()
                .copied()
                .map(wasmi_value)
                .collect::<Vec<_>>();
            let mut outputs = result_types
                .iter()
                .copied()
                .map(CoreScalarValue::zero)
                .map(wasmi_value)
                .collect::<Vec<_>>();
            invoke_wasmi_bounded_with_cancellation(
                &mut store,
                &function,
                &inputs,
                &mut outputs,
                profile,
                Some(cancellation),
            )
            .map_err(|error| invocation_error("Wasmi call", error))?;
            outputs
                .iter()
                .map(|value| {
                    core_value_from_wasmi(value)
                        .map_err(|error| invocation_error("Wasmi result conversion", error))
                })
                .collect()
        })();
        let state = store
            .into_data()
            .state
            .expect("scalar Host state must be restored after invocation");
        ErasedScalarOutcome { result, state }
    }
}

fn invoke_callback(
    caller: &mut WasmiCaller<'_, ScalarCallbacks>,
    index: usize,
    arguments: &[CoreScalarValue],
) -> Result<Vec<CoreScalarValue>, CoreScalarHostError> {
    let (mut state, mut callback) = take_callback(caller.data_mut(), index)?;
    let mut memory = WasmiScalarMemory { caller };
    let result = callback(state.as_mut(), &mut memory, arguments);
    restore_callback(memory.caller.data_mut(), index, state, callback);
    result
}

struct WasmiScalarMemory<'a, 'b> {
    caller: &'a mut WasmiCaller<'b, ScalarCallbacks>,
}

impl CoreScalarMemory for WasmiScalarMemory<'_, '_> {
    fn byte_len(&mut self) -> Result<usize, CoreScalarHostError> {
        Ok(wasmi_memory(self.caller)?.data_size(&*self.caller))
    }

    fn read(&mut self, offset: u32, destination: &mut [u8]) -> Result<(), CoreScalarHostError> {
        wasmi_memory(self.caller)?
            .read(&*self.caller, offset as usize, destination)
            .map_err(|error| CoreScalarHostError::memory(format!("Wasmi memory read: {error}")))
    }

    fn write(&mut self, offset: u32, source: &[u8]) -> Result<(), CoreScalarHostError> {
        wasmi_memory(self.caller)?
            .write(&mut *self.caller, offset as usize, source)
            .map_err(|error| CoreScalarHostError::memory(format!("Wasmi memory write: {error}")))
    }
}

fn wasmi_memory(
    caller: &WasmiCaller<'_, ScalarCallbacks>,
) -> Result<wasmi::Memory, CoreScalarHostError> {
    match caller.get_export(MEMORY_EXPORT) {
        Some(WasmiExtern::Memory(memory)) => Ok(memory),
        _ => Err(CoreScalarHostError::memory(
            "calling Core instance exports no memory named memory",
        )),
    }
}

pub(crate) struct WasmtimeScalarHostModule {
    runtime: WasmtimeSpeedRuntime,
    instance_pre: WasmtimeInstancePre<ScalarCallbacks>,
    imports: Arc<[CoreScalarHostImport]>,
}

impl WasmtimeScalarHostModule {
    pub(crate) fn compile(
        runtime: &WasmtimeSpeedRuntime,
        wasm: &[u8],
        reviewed: &[CoreScalarHostImport],
    ) -> Result<Self, CoreScalarHostError> {
        validate_plan(reviewed)?;
        let module = WasmtimeModule::new(runtime.engine(), wasm).map_err(|error| {
            CoreScalarHostError::new(
                CoreScalarHostErrorCode::Compile,
                format!("Wasmtime rejected scalar Core module: {error}"),
            )
        })?;
        let actual = module
            .imports()
            .map(|import| {
                let WasmtimeExternType::Func(function) = import.ty() else {
                    return Err(import_kind_error(import.module(), import.name()));
                };
                let params = function
                    .params()
                    .map(core_type_from_wasmtime)
                    .collect::<Result<Vec<_>, _>>()?;
                let results = function
                    .results()
                    .map(core_type_from_wasmtime)
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(CoreScalarHostImport::new(
                    import.module(),
                    import.name(),
                    params,
                    results,
                ))
            })
            .collect::<Result<Vec<_>, _>>()?;
        require_exact_imports(&actual, reviewed)?;
        let mut linker = WasmtimeLinker::<ScalarCallbacks>::new(runtime.engine());
        for (index, import) in reviewed.iter().enumerate() {
            let expected_results = import.results.clone();
            let ty = WasmtimeFuncType::new(
                runtime.engine(),
                import.params.iter().copied().map(wasmtime_type),
                import.results.iter().copied().map(wasmtime_type),
            );
            linker
                .func_new(
                    import.module(),
                    import.name(),
                    ty,
                    move |mut caller, params, results| {
                        let arguments = params
                            .iter()
                            .map(core_value_from_wasmtime)
                            .collect::<Result<Vec<_>, _>>()?;
                        let (mut state, mut callback) = take_callback(caller.data_mut(), index)
                            .map_err(|error| wasmtime::Error::msg(error.to_string()))?;
                        let mut memory = WasmtimeScalarMemory {
                            caller: &mut caller,
                        };
                        let returned = callback(state.as_mut(), &mut memory, &arguments);
                        restore_callback(memory.caller.data_mut(), index, state, callback);
                        let returned =
                            returned.map_err(|error| wasmtime::Error::msg(error.to_string()))?;
                        if returned.len() != results.len() {
                            return Err(wasmtime::Error::msg("scalar Host result arity mismatch"));
                        }
                        require_value_types(&returned, &expected_results)
                            .map_err(|error| wasmtime::Error::msg(error.to_string()))?;
                        for (slot, value) in results.iter_mut().zip(returned) {
                            *slot = wasmtime_value(value);
                        }
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

    pub(crate) fn invoke_with_state(
        &self,
        session: ErasedScalarSession,
        export: &str,
        arguments: &[CoreScalarValue],
        cancellation: &CoreRuntimeCancellation,
    ) -> ErasedScalarOutcome {
        let state_on_error = |error, session: ErasedScalarSession| ErasedScalarOutcome {
            result: Err(error),
            state: session.state,
        };
        if let Err(error) = validate_call_shape(arguments) {
            return state_on_error(error, session);
        }
        let actual = session
            .bindings
            .iter()
            .map(|binding| binding.import.clone())
            .collect::<Vec<_>>();
        if let Err(error) = require_exact_imports(&actual, &self.imports) {
            return state_on_error(error, session);
        }
        let profile = self.runtime.limits();
        let callbacks = exact_callbacks(session, profile);
        let mut store = WasmtimeStore::new(self.runtime.engine(), callbacks);
        if profile.is_bounded() {
            store.limiter(|data| &mut data.wasmtime_limits);
            if let Err(error) = store.set_fuel(profile.wasmtime_fuel()) {
                let state = store
                    .into_data()
                    .state
                    .expect("scalar Host state must exist after fuel setup failure");
                return ErasedScalarOutcome {
                    result: Err(invocation_error("Wasmtime fuel setup", error)),
                    state,
                };
            }
            let cancellation = cancellation.clone();
            let deadline = std::time::Instant::now()
                .checked_add(std::time::Duration::from_nanos(profile.wall_clock_ns()))
                .expect("validated Core wall-clock deadline must fit Instant");
            store.epoch_deadline_callback(move |_store| {
                if cancellation.is_cancelled() || std::time::Instant::now() >= deadline {
                    Ok(UpdateDeadline::Interrupt)
                } else {
                    Ok(UpdateDeadline::Continue(1))
                }
            });
            store.set_epoch_deadline(1);
        }
        let result = (|| {
            let instance = self.instance_pre.instantiate(&mut store).map_err(|error| {
                invocation_error("Wasmtime instantiation", format!("{error:#}"))
            })?;
            let function = instance.get_func(&mut store, export).ok_or_else(|| {
                invocation_message(format!("Wasmtime export {export:?} is missing"))
            })?;
            let result_types = function
                .ty(&store)
                .results()
                .map(core_type_from_wasmtime)
                .collect::<Result<Vec<_>, _>>()?;
            validate_result_shape(&result_types)?;
            let inputs = arguments
                .iter()
                .copied()
                .map(wasmtime_value)
                .collect::<Vec<_>>();
            let mut outputs = result_types
                .iter()
                .copied()
                .map(CoreScalarValue::zero)
                .map(wasmtime_value)
                .collect::<Vec<_>>();
            if cancellation.is_cancelled() {
                return Err(invocation_message("Core invocation cancelled"));
            }
            function
                .call(&mut store, &inputs, &mut outputs)
                .map_err(|error| invocation_error("Wasmtime call", format!("{error:#}")))?;
            if cancellation.is_cancelled() {
                return Err(invocation_message("Core invocation cancelled"));
            }
            outputs
                .iter()
                .map(|value| {
                    core_value_from_wasmtime(value)
                        .map_err(|error| invocation_error("Wasmtime result conversion", error))
                })
                .collect()
        })();
        let state = store
            .into_data()
            .state
            .expect("scalar Host state must be restored after invocation");
        ErasedScalarOutcome { result, state }
    }
}

struct WasmtimeScalarMemory<'a, 'b> {
    caller: &'a mut wasmtime::Caller<'b, ScalarCallbacks>,
}

impl CoreScalarMemory for WasmtimeScalarMemory<'_, '_> {
    fn byte_len(&mut self) -> Result<usize, CoreScalarHostError> {
        Ok(wasmtime_memory(self.caller)?.data_size(&*self.caller))
    }

    fn read(&mut self, offset: u32, destination: &mut [u8]) -> Result<(), CoreScalarHostError> {
        wasmtime_memory(self.caller)?
            .read(&*self.caller, offset as usize, destination)
            .map_err(|error| CoreScalarHostError::memory(format!("Wasmtime memory read: {error}")))
    }

    fn write(&mut self, offset: u32, source: &[u8]) -> Result<(), CoreScalarHostError> {
        wasmtime_memory(self.caller)?
            .write(&mut *self.caller, offset as usize, source)
            .map_err(|error| CoreScalarHostError::memory(format!("Wasmtime memory write: {error}")))
    }
}

fn wasmtime_memory(
    caller: &mut wasmtime::Caller<'_, ScalarCallbacks>,
) -> Result<wasmtime::Memory, CoreScalarHostError> {
    match caller.get_export(MEMORY_EXPORT) {
        Some(WasmtimeExtern::Memory(memory)) => Ok(memory),
        _ => Err(CoreScalarHostError::memory(
            "calling Core instance exports no memory named memory",
        )),
    }
}

fn take_callback(
    callbacks: &mut ScalarCallbacks,
    index: usize,
) -> Result<(Box<dyn Any + Send>, ScalarCallback), CoreScalarHostError> {
    let state = callbacks
        .state
        .take()
        .ok_or_else(|| CoreScalarHostError::callback("reentrant scalar Host state"))?;
    let callback = callbacks.callbacks[index]
        .take()
        .ok_or_else(|| CoreScalarHostError::callback("reentrant scalar Host callback"))?;
    Ok((state, callback))
}

fn restore_callback(
    callbacks: &mut ScalarCallbacks,
    index: usize,
    state: Box<dyn Any + Send>,
    callback: ScalarCallback,
) {
    callbacks.state = Some(state);
    callbacks.callbacks[index] = Some(callback);
}

fn validate_plan(reviewed: &[CoreScalarHostImport]) -> Result<(), CoreScalarHostError> {
    if reviewed.is_empty() || reviewed.len() > MAX_IMPORTS {
        return Err(CoreScalarHostError::new(
            CoreScalarHostErrorCode::InvalidPlan,
            format!("scalar Host plan must contain 1..={MAX_IMPORTS} rows"),
        ));
    }
    let mut unique = BTreeSet::new();
    for import in reviewed {
        if import.module.is_empty()
            || import.name.is_empty()
            || import.params.len() > MAX_VALUES
            || import.results.len() > MAX_VALUES
        {
            return Err(CoreScalarHostError::new(
                CoreScalarHostErrorCode::InvalidPlan,
                format!(
                    "invalid scalar Host import {}.{}",
                    import.module, import.name
                ),
            ));
        }
        if !unique.insert((import.module.as_str(), import.name.as_str())) {
            return Err(CoreScalarHostError::new(
                CoreScalarHostErrorCode::InvalidPlan,
                format!(
                    "duplicate scalar Host import {}.{}",
                    import.module, import.name
                ),
            ));
        }
    }
    Ok(())
}

fn validate_call_shape(arguments: &[CoreScalarValue]) -> Result<(), CoreScalarHostError> {
    if arguments.len() > MAX_VALUES {
        return Err(CoreScalarHostError::new(
            CoreScalarHostErrorCode::InvalidPlan,
            format!("scalar call exceeds {MAX_VALUES} values"),
        ));
    }
    Ok(())
}

fn validate_result_shape(results: &[CoreScalarType]) -> Result<(), CoreScalarHostError> {
    if results.len() > MAX_VALUES {
        return Err(CoreScalarHostError::new(
            CoreScalarHostErrorCode::InvalidPlan,
            format!("scalar call exceeds {MAX_VALUES} results"),
        ));
    }
    Ok(())
}

fn require_value_types(
    values: &[CoreScalarValue],
    expected: &[CoreScalarType],
) -> Result<(), CoreScalarHostError> {
    if values.len() != expected.len()
        || values
            .iter()
            .zip(expected)
            .any(|(value, expected)| value.value_type() != *expected)
    {
        return Err(CoreScalarHostError::callback(
            "scalar Host result types do not match the reviewed import",
        ));
    }
    Ok(())
}

fn require_exact_imports(
    actual: &[CoreScalarHostImport],
    reviewed: &[CoreScalarHostImport],
) -> Result<(), CoreScalarHostError> {
    if actual != reviewed {
        return Err(CoreScalarHostError::new(
            CoreScalarHostErrorCode::ImportMismatch,
            format!("Core imports {actual:?} do not equal reviewed scalar plan {reviewed:?}"),
        ));
    }
    Ok(())
}

fn exact_callbacks(
    session: ErasedScalarSession,
    profile: CoreRuntimeLimitProfile,
) -> ScalarCallbacks {
    ScalarCallbacks {
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
    }
}

fn import_kind_error(module: &str, name: &str) -> CoreScalarHostError {
    CoreScalarHostError::new(
        CoreScalarHostErrorCode::ImportMismatch,
        format!("import {module}.{name} is not a scalar function"),
    )
}

fn binding_error(engine: &str, error: impl fmt::Display) -> CoreScalarHostError {
    CoreScalarHostError::new(
        CoreScalarHostErrorCode::Binding,
        format!("{engine} scalar Host binding failed: {error}"),
    )
}

fn invocation_error(stage: &str, error: impl fmt::Display) -> CoreScalarHostError {
    let message = error.to_string();
    CoreScalarHostError::new(
        if is_resource_limit_message(&message) {
            CoreScalarHostErrorCode::ResourceLimit
        } else {
            CoreScalarHostErrorCode::Invocation
        },
        format!("{stage} failed: {message}"),
    )
}

fn invocation_message(message: impl Into<String>) -> CoreScalarHostError {
    CoreScalarHostError::new(CoreScalarHostErrorCode::Invocation, message)
}

fn core_type_from_wasmi(value: WasmiValType) -> Result<CoreScalarType, CoreScalarHostError> {
    match value {
        WasmiValType::I32 => Ok(CoreScalarType::I32),
        WasmiValType::I64 => Ok(CoreScalarType::I64),
        WasmiValType::F32 => Ok(CoreScalarType::F32),
        WasmiValType::F64 => Ok(CoreScalarType::F64),
        _ => Err(CoreScalarHostError::new(
            CoreScalarHostErrorCode::ImportMismatch,
            "non-scalar Wasmi value type",
        )),
    }
}

fn wasmi_type(value: CoreScalarType) -> WasmiValType {
    match value {
        CoreScalarType::I32 => WasmiValType::I32,
        CoreScalarType::I64 => WasmiValType::I64,
        CoreScalarType::F32 => WasmiValType::F32,
        CoreScalarType::F64 => WasmiValType::F64,
    }
}

fn core_value_from_wasmi(value: &WasmiVal) -> Result<CoreScalarValue, wasmi::Error> {
    match value {
        WasmiVal::I32(value) => Ok(CoreScalarValue::I32(*value)),
        WasmiVal::I64(value) => Ok(CoreScalarValue::I64(*value)),
        WasmiVal::F32(value) => Ok(CoreScalarValue::F32(value.to_bits())),
        WasmiVal::F64(value) => Ok(CoreScalarValue::F64(value.to_bits())),
        _ => Err(wasmi::Error::new("non-scalar Wasmi value")),
    }
}

fn wasmi_value(value: CoreScalarValue) -> WasmiVal {
    match value {
        CoreScalarValue::I32(value) => WasmiVal::I32(value),
        CoreScalarValue::I64(value) => WasmiVal::I64(value),
        CoreScalarValue::F32(value) => WasmiVal::F32(f32::from_bits(value).into()),
        CoreScalarValue::F64(value) => WasmiVal::F64(f64::from_bits(value).into()),
    }
}

fn core_type_from_wasmtime(value: WasmtimeValType) -> Result<CoreScalarType, CoreScalarHostError> {
    match value {
        WasmtimeValType::I32 => Ok(CoreScalarType::I32),
        WasmtimeValType::I64 => Ok(CoreScalarType::I64),
        WasmtimeValType::F32 => Ok(CoreScalarType::F32),
        WasmtimeValType::F64 => Ok(CoreScalarType::F64),
        _ => Err(CoreScalarHostError::new(
            CoreScalarHostErrorCode::ImportMismatch,
            "non-scalar Wasmtime value type",
        )),
    }
}

fn wasmtime_type(value: CoreScalarType) -> WasmtimeValType {
    match value {
        CoreScalarType::I32 => WasmtimeValType::I32,
        CoreScalarType::I64 => WasmtimeValType::I64,
        CoreScalarType::F32 => WasmtimeValType::F32,
        CoreScalarType::F64 => WasmtimeValType::F64,
    }
}

fn core_value_from_wasmtime(value: &WasmtimeVal) -> Result<CoreScalarValue, wasmtime::Error> {
    match value {
        WasmtimeVal::I32(value) => Ok(CoreScalarValue::I32(*value)),
        WasmtimeVal::I64(value) => Ok(CoreScalarValue::I64(*value)),
        WasmtimeVal::F32(value) => Ok(CoreScalarValue::F32(*value)),
        WasmtimeVal::F64(value) => Ok(CoreScalarValue::F64(*value)),
        _ => Err(wasmtime::Error::msg("non-scalar Wasmtime value")),
    }
}

fn wasmtime_value(value: CoreScalarValue) -> WasmtimeVal {
    match value {
        CoreScalarValue::I32(value) => WasmtimeVal::I32(value),
        CoreScalarValue::I64(value) => WasmtimeVal::I64(value),
        CoreScalarValue::F32(value) => WasmtimeVal::F32(value),
        CoreScalarValue::F64(value) => WasmtimeVal::F64(value),
    }
}
