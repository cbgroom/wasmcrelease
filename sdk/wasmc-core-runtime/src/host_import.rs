//! Exact synchronous scalar Host imports shared by Wasmi and Wasmtime.
//!
//! This module owns one data-only import plan and two engine adapters. The plan
//! grants no authority by itself: every fresh request supplies callbacks whose
//! identities must exactly match the reviewed plan. Candidate compilation only
//! validates and links dispatch stubs; it never executes a Host callback.

use std::{collections::BTreeSet, error::Error, fmt, sync::Arc};

use wasmi::{
    Caller as WasmiCaller, ExternType as WasmiExternType, Instance as WasmiInstance,
    Linker as WasmiLinker, Module as WasmiModule, Store as WasmiStore,
    StoreLimits as WasmiStoreLimits, StoreLimitsBuilder as WasmiStoreLimitsBuilder,
    Val as WasmiVal, ValType as WasmiValType,
};
use wasmtime::{
    ExternType as WasmtimeExternType, InstancePre as WasmtimeInstancePre, Linker as WasmtimeLinker,
    Module as WasmtimeModule, Store as WasmtimeStore, StoreLimits as WasmtimeStoreLimits,
    StoreLimitsBuilder as WasmtimeStoreLimitsBuilder, ValType as WasmtimeValType,
};

use crate::{
    limits::{invoke_wasmi_bounded, is_resource_limit_message},
    CoreRuntimeLimitProfile, WasmiCompletionRuntime, WasmtimeSpeedRuntime,
};

const MAX_I32_HOST_IMPORTS: usize = 32;

type I32HostCallback = Arc<dyn Fn(i32) -> i32 + Send + Sync + 'static>;

/// One exact synchronous Core function import admitted by the v0 Host lane.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct I32HostImport {
    module: String,
    name: String,
}

impl I32HostImport {
    pub fn new(module: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            module: module.into(),
            name: name.into(),
        }
    }

    pub fn module(&self) -> &str {
        &self.module
    }

    pub fn name(&self) -> &str {
        &self.name
    }
}

/// One request-local implementation of an exact reviewed import.
#[derive(Clone)]
pub struct I32HostBinding {
    import: I32HostImport,
    callback: I32HostCallback,
}

impl I32HostBinding {
    pub fn new<F>(import: I32HostImport, callback: F) -> Self
    where
        F: Fn(i32) -> i32 + Send + Sync + 'static,
    {
        Self {
            import,
            callback: Arc::new(callback),
        }
    }

    pub fn import(&self) -> &I32HostImport {
        &self.import
    }
}

/// Stable failure classes shared by both adapters.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum I32HostImportErrorCode {
    InvalidPlan,
    ImportMismatch,
    Compile,
    Binding,
    Invocation,
    ResourceLimit,
}

/// Engine-neutral error for exact Host import admission and invocation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct I32HostImportError {
    code: I32HostImportErrorCode,
    message: String,
}

impl I32HostImportError {
    fn new(code: I32HostImportErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub const fn code(&self) -> I32HostImportErrorCode {
        self.code
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

impl fmt::Display for I32HostImportError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl Error for I32HostImportError {}

struct HostCallbacks {
    callbacks: Vec<I32HostCallback>,
    wasmi_limits: WasmiStoreLimits,
    wasmtime_limits: WasmtimeStoreLimits,
}

impl HostCallbacks {
    fn new(callbacks: Vec<I32HostCallback>, profile: CoreRuntimeLimitProfile) -> Self {
        Self {
            callbacks,
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
}

pub(crate) struct WasmiI32HostModule {
    runtime: WasmiCompletionRuntime,
    module: WasmiModule,
    imports: Arc<[I32HostImport]>,
}

impl WasmiI32HostModule {
    pub(crate) fn compile(
        runtime: &WasmiCompletionRuntime,
        wasm: &[u8],
        reviewed: &[I32HostImport],
    ) -> Result<Self, I32HostImportError> {
        validate_plan(reviewed)?;
        let module = WasmiModule::new(runtime.engine(), wasm).map_err(|error| {
            I32HostImportError::new(
                I32HostImportErrorCode::Compile,
                format!("Wasmi rejected Core module: {error}"),
            )
        })?;
        let actual = module
            .imports()
            .map(|import| {
                let WasmiExternType::Func(function) = import.ty() else {
                    return Err(I32HostImportError::new(
                        I32HostImportErrorCode::ImportMismatch,
                        format!(
                            "import {}.{} is not a function",
                            import.module(),
                            import.name()
                        ),
                    ));
                };
                if function.params() != [WasmiValType::I32]
                    || function.results() != [WasmiValType::I32]
                {
                    return Err(I32HostImportError::new(
                        I32HostImportErrorCode::ImportMismatch,
                        format!(
                            "import {}.{} is not exact (i32)->i32",
                            import.module(),
                            import.name()
                        ),
                    ));
                }
                Ok(I32HostImport::new(import.module(), import.name()))
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

    pub(crate) fn imports(&self) -> &[I32HostImport] {
        &self.imports
    }

    pub(crate) fn invoke_i32(
        &self,
        bindings: &[I32HostBinding],
        export: &str,
        argument: i32,
    ) -> Result<i32, I32HostImportError> {
        let callbacks = exact_callbacks(&self.imports, bindings)?;
        let mut linker = WasmiLinker::<HostCallbacks>::new(self.runtime.engine());
        for (index, import) in self.imports.iter().enumerate() {
            linker
                .func_wrap(
                    import.module(),
                    import.name(),
                    move |caller: WasmiCaller<'_, HostCallbacks>, value: i32| {
                        (caller.data().callbacks[index])(value)
                    },
                )
                .map_err(|error| {
                    I32HostImportError::new(
                        I32HostImportErrorCode::Binding,
                        format!("Wasmi Host binding failed: {error}"),
                    )
                })?;
        }
        let profile = self.runtime.limits();
        let mut store = WasmiStore::new(
            self.runtime.engine(),
            HostCallbacks::new(callbacks, profile),
        );
        if profile.is_bounded() {
            store.limiter(|data| &mut data.wasmi_limits);
            store.set_fuel(profile.wasmi_fuel()).map_err(|error| {
                I32HostImportError::new(
                    I32HostImportErrorCode::ResourceLimit,
                    format!("Wasmi fuel setup failed: {error}"),
                )
            })?;
        }
        let instance: WasmiInstance = linker
            .instantiate_and_start(&mut store, &self.module)
            .map_err(|error| invocation_error("Wasmi instantiation", error.to_string()))?;
        let function = instance.get_func(&store, export).ok_or_else(|| {
            I32HostImportError::new(
                I32HostImportErrorCode::Invocation,
                format!("Wasmi export {export:?} is missing"),
            )
        })?;
        let inputs = [WasmiVal::I32(argument)];
        let mut outputs = [WasmiVal::I32(0)];
        invoke_wasmi_bounded(&mut store, &function, &inputs, &mut outputs, profile)
            .map_err(|error| invocation_error("Wasmi invocation", error.to_string()))?;
        match outputs[0] {
            WasmiVal::I32(value) => Ok(value),
            _ => Err(I32HostImportError::new(
                I32HostImportErrorCode::Invocation,
                "Wasmi export result is not i32",
            )),
        }
    }
}

pub(crate) struct WasmtimeI32HostModule {
    runtime: WasmtimeSpeedRuntime,
    instance_pre: WasmtimeInstancePre<HostCallbacks>,
    imports: Arc<[I32HostImport]>,
}

impl WasmtimeI32HostModule {
    pub(crate) fn compile(
        runtime: &WasmtimeSpeedRuntime,
        wasm: &[u8],
        reviewed: &[I32HostImport],
    ) -> Result<Self, I32HostImportError> {
        validate_plan(reviewed)?;
        let module = WasmtimeModule::new(runtime.engine(), wasm).map_err(|error| {
            I32HostImportError::new(
                I32HostImportErrorCode::Compile,
                format!("Wasmtime rejected Core module: {error}"),
            )
        })?;
        let actual = module
            .imports()
            .map(|import| {
                let WasmtimeExternType::Func(function) = import.ty() else {
                    return Err(I32HostImportError::new(
                        I32HostImportErrorCode::ImportMismatch,
                        format!(
                            "import {}.{} is not a function",
                            import.module(),
                            import.name()
                        ),
                    ));
                };
                let mut params = function.params();
                let mut results = function.results();
                if !matches!(params.next(), Some(WasmtimeValType::I32))
                    || params.next().is_some()
                    || !matches!(results.next(), Some(WasmtimeValType::I32))
                    || results.next().is_some()
                {
                    return Err(I32HostImportError::new(
                        I32HostImportErrorCode::ImportMismatch,
                        format!(
                            "import {}.{} is not exact (i32)->i32",
                            import.module(),
                            import.name()
                        ),
                    ));
                }
                Ok(I32HostImport::new(import.module(), import.name()))
            })
            .collect::<Result<Vec<_>, _>>()?;
        require_exact_imports(&actual, reviewed)?;

        let mut linker = WasmtimeLinker::<HostCallbacks>::new(runtime.engine());
        for (index, import) in reviewed.iter().enumerate() {
            linker
                .func_wrap(
                    import.module(),
                    import.name(),
                    move |caller: wasmtime::Caller<'_, HostCallbacks>, value: i32| {
                        (caller.data().callbacks[index])(value)
                    },
                )
                .map_err(|error| {
                    I32HostImportError::new(
                        I32HostImportErrorCode::Binding,
                        format!("Wasmtime Host binding failed: {error}"),
                    )
                })?;
        }
        let instance_pre = linker.instantiate_pre(&module).map_err(|error| {
            I32HostImportError::new(
                I32HostImportErrorCode::Binding,
                format!("Wasmtime link plan failed: {error}"),
            )
        })?;
        runtime.record_compile();
        Ok(Self {
            runtime: runtime.clone(),
            instance_pre,
            imports: Arc::from(reviewed),
        })
    }

    pub(crate) fn invoke_i32(
        &self,
        bindings: &[I32HostBinding],
        export: &str,
        argument: i32,
    ) -> Result<i32, I32HostImportError> {
        let callbacks = exact_callbacks(&self.imports, bindings)?;
        let profile = self.runtime.limits();
        let mut store = WasmtimeStore::new(
            self.runtime.engine(),
            HostCallbacks::new(callbacks, profile),
        );
        if profile.is_bounded() {
            store.limiter(|data| &mut data.wasmtime_limits);
            store.set_fuel(profile.wasmtime_fuel()).map_err(|error| {
                I32HostImportError::new(
                    I32HostImportErrorCode::ResourceLimit,
                    format!("Wasmtime fuel setup failed: {error}"),
                )
            })?;
            store.set_epoch_deadline(profile.wasmtime_deadline_ticks());
        }
        let instance = self
            .instance_pre
            .instantiate(&mut store)
            .map_err(|error| invocation_error("Wasmtime instantiation", format!("{error:#}")))?;
        let function = instance
            .get_typed_func::<i32, i32>(&mut store, export)
            .map_err(|error| {
                I32HostImportError::new(
                    I32HostImportErrorCode::Invocation,
                    format!("Wasmtime export lookup failed: {error}"),
                )
            })?;
        function
            .call(&mut store, argument)
            .map_err(|error| invocation_error("Wasmtime invocation", format!("{error:#}")))
    }
}

fn validate_plan(reviewed: &[I32HostImport]) -> Result<(), I32HostImportError> {
    if reviewed.is_empty() || reviewed.len() > MAX_I32_HOST_IMPORTS {
        return Err(I32HostImportError::new(
            I32HostImportErrorCode::InvalidPlan,
            format!("Host import plan must contain 1..={MAX_I32_HOST_IMPORTS} rows"),
        ));
    }
    let mut unique = BTreeSet::new();
    for import in reviewed {
        if import.module.is_empty() || import.name.is_empty() {
            return Err(I32HostImportError::new(
                I32HostImportErrorCode::InvalidPlan,
                "Host import module and name must be non-empty",
            ));
        }
        if !unique.insert((import.module.as_str(), import.name.as_str())) {
            return Err(I32HostImportError::new(
                I32HostImportErrorCode::InvalidPlan,
                format!("duplicate Host import {}.{}", import.module, import.name),
            ));
        }
    }
    Ok(())
}

fn require_exact_imports(
    actual: &[I32HostImport],
    reviewed: &[I32HostImport],
) -> Result<(), I32HostImportError> {
    if actual != reviewed {
        return Err(I32HostImportError::new(
            I32HostImportErrorCode::ImportMismatch,
            format!("Core imports {actual:?} do not equal reviewed plan {reviewed:?}"),
        ));
    }
    Ok(())
}

fn exact_callbacks(
    reviewed: &[I32HostImport],
    bindings: &[I32HostBinding],
) -> Result<Vec<I32HostCallback>, I32HostImportError> {
    let actual = bindings
        .iter()
        .map(|binding| binding.import.clone())
        .collect::<Vec<_>>();
    require_exact_imports(&actual, reviewed)?;
    Ok(bindings
        .iter()
        .map(|binding| Arc::clone(&binding.callback))
        .collect())
}

fn invocation_error(stage: &str, message: String) -> I32HostImportError {
    I32HostImportError::new(
        if is_resource_limit_message(&message) {
            I32HostImportErrorCode::ResourceLimit
        } else {
            I32HostImportErrorCode::Invocation
        },
        format!("{stage} failed: {message}"),
    )
}
