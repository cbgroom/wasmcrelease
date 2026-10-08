//! Bounded Wasmi-only facade for an exact synchronous scalar Host import plan.

use std::sync::Arc;

use crate::{
    host_import::WasmiI32HostModule,
    host_lane::{ErasedLaneSession, WasmiI32LaneHostModule},
    limits::ConcurrentStoreAdmission,
    scalar_host_lane::WasmiScalarHostModule,
    CoreRuntimeCancellation, CoreRuntimeLimitProfile, CoreScalarHostError, CoreScalarHostSession,
    CoreScalarValue, I32HostBinding, I32HostImport, I32HostImportError, I32HostImportErrorCode,
    I32LaneHostBinding, I32LaneHostError, I32LaneHostImport, I32LaneHostSession,
    WasmiCompletionRuntime,
};

/// Reusable Wasmi engine and Host-owned admission policy.
///
/// Construction accepts only a complete bounded Wasmi profile. It creates no
/// Store, thread, file descriptor, callback, or ambient capability.
#[derive(Clone)]
pub struct WasmiHostRuntime {
    runtime: WasmiCompletionRuntime,
    admission: Arc<ConcurrentStoreAdmission>,
}

impl WasmiHostRuntime {
    /// Create one lazy Wasmi-only runtime with explicit resource limits.
    pub fn new(limits: CoreRuntimeLimitProfile) -> Result<Self, I32HostImportError> {
        if !limits.is_bounded() {
            return Err(I32HostImportError::new(
                I32HostImportErrorCode::InvalidPlan,
                "Wasmi Host runtime requires a bounded limit profile",
            ));
        }
        limits.validate_wasmi().map_err(|message| {
            I32HostImportError::new(I32HostImportErrorCode::InvalidPlan, message)
        })?;
        Ok(Self {
            runtime: WasmiCompletionRuntime::new_with_limits(limits),
            admission: Arc::new(ConcurrentStoreAdmission::new(limits)),
        })
    }

    /// Compile and admit one module against an exact reviewed import plan.
    pub fn prepare_i32_host(
        &self,
        wasm: &[u8],
        reviewed_imports: &[I32HostImport],
    ) -> Result<WasmiHostArtifact, I32HostImportError> {
        let module = WasmiI32HostModule::compile(&self.runtime, wasm, reviewed_imports)?;
        Ok(WasmiHostArtifact {
            module,
            admission: Arc::clone(&self.admission),
            wasm_bytes: wasm.len(),
        })
    }

    /// Compile one import-free scalar Lib without granting Host authority.
    pub fn prepare_i32_lib(&self, wasm: &[u8]) -> Result<WasmiHostArtifact, I32HostImportError> {
        let module = WasmiI32HostModule::compile_import_free(&self.runtime, wasm)?;
        Ok(WasmiHostArtifact {
            module,
            admission: Arc::clone(&self.admission),
            wasm_bytes: wasm.len(),
        })
    }

    /// Compile one import-free flat-scalar Lib without granting Host authority.
    pub fn prepare_scalar_lib(
        &self,
        wasm: &[u8],
    ) -> Result<WasmiScalarLibArtifact, CoreScalarHostError> {
        let module = WasmiScalarHostModule::compile_import_free(&self.runtime, wasm)?;
        Ok(WasmiScalarLibArtifact {
            module,
            admission: Arc::clone(&self.admission),
            wasm_bytes: wasm.len(),
        })
    }

    /// Compile and admit one module against an exact reviewed memory-backed
    /// i32 Host lane. Authority remains entirely in request-local bindings.
    pub fn prepare_i32_lane_host(
        &self,
        wasm: &[u8],
        reviewed_imports: &[I32LaneHostImport],
    ) -> Result<WasmiLaneHostArtifact, I32LaneHostError> {
        let module = WasmiI32LaneHostModule::compile(&self.runtime, wasm, reviewed_imports)?;
        Ok(WasmiLaneHostArtifact {
            module,
            admission: Arc::clone(&self.admission),
            wasm_bytes: wasm.len(),
        })
    }

    /// Number of successfully prepared modules on this runtime.
    pub fn compile_count(&self) -> u64 {
        self.runtime.compile_count()
    }
}

/// One admitted import-free Core scalar Lib. Every invocation creates a fresh
/// bounded Store and Instance and accepts only exact Core scalar lanes.
pub struct WasmiScalarLibArtifact {
    module: WasmiScalarHostModule,
    admission: Arc<ConcurrentStoreAdmission>,
    wasm_bytes: usize,
}

impl WasmiScalarLibArtifact {
    pub const fn wasm_bytes(&self) -> usize {
        self.wasm_bytes
    }

    pub fn invoke(
        &self,
        export: &str,
        arguments: &[CoreScalarValue],
    ) -> Result<Vec<CoreScalarValue>, CoreScalarHostError> {
        let _permit = self.admission.try_acquire().ok_or_else(|| {
            CoreScalarHostError::resource_limit("Wasmi concurrent Store limit exhausted")
        })?;
        let outcome = self.module.invoke_with_state(
            CoreScalarHostSession::new(()).erase(),
            export,
            arguments,
            &CoreRuntimeCancellation::new(),
        );
        outcome.into_result()
    }
}

/// One memory-backed Wasmi Host invocation result with recovered request-local state.
pub struct WasmiLaneHostOutcome<S> {
    pub result: Result<i32, I32LaneHostError>,
    pub state: S,
}

/// One admitted memory-backed Core module. Every invocation creates a fresh
/// bounded Store and Instance and consumes one exact request-local session.
pub struct WasmiLaneHostArtifact {
    module: WasmiI32LaneHostModule,
    admission: Arc<ConcurrentStoreAdmission>,
    wasm_bytes: usize,
}

impl WasmiLaneHostArtifact {
    pub const fn wasm_bytes(&self) -> usize {
        self.wasm_bytes
    }

    pub fn imports(&self) -> &[I32LaneHostImport] {
        self.module.imports()
    }

    pub fn invoke_i32_lane(
        &self,
        bindings: Vec<I32LaneHostBinding>,
        export: &str,
        arguments: &[i32],
    ) -> Result<i32, I32LaneHostError> {
        let _permit = self.admission.try_acquire().ok_or_else(|| {
            I32LaneHostError::resource_limit("Wasmi concurrent Store limit exhausted")
        })?;
        self.module
            .invoke(ErasedLaneSession::stateless(bindings), export, arguments)
    }

    pub fn invoke_i32_lane_with_session<S>(
        &self,
        session: I32LaneHostSession<S>,
        export: &str,
        arguments: &[i32],
    ) -> WasmiLaneHostOutcome<S>
    where
        S: Send + 'static,
    {
        let session = session.erase();
        let Some(_permit) = self.admission.try_acquire() else {
            return WasmiLaneHostOutcome {
                result: Err(I32LaneHostError::resource_limit(
                    "Wasmi concurrent Store limit exhausted",
                )),
                state: session.into_state(),
            };
        };
        let (result, state) = self
            .module
            .invoke_with_state(session, export, arguments)
            .into_typed();
        WasmiLaneHostOutcome { result, state }
    }
}

/// One admitted Core module. Every invocation still creates a fresh Store and
/// Instance and supplies exact request-local bindings.
pub struct WasmiHostArtifact {
    module: WasmiI32HostModule,
    admission: Arc<ConcurrentStoreAdmission>,
    wasm_bytes: usize,
}

impl WasmiHostArtifact {
    /// Exact size of the prepared input artifact.
    pub const fn wasm_bytes(&self) -> usize {
        self.wasm_bytes
    }

    /// Exact reviewed imports in module order.
    pub fn imports(&self) -> &[I32HostImport] {
        self.module.imports()
    }

    /// Invoke one typed export with fresh request-local engine state.
    pub fn invoke_i32(
        &self,
        bindings: &[I32HostBinding],
        export: &str,
        argument: i32,
    ) -> Result<i32, I32HostImportError> {
        let _permit = self.admission.try_acquire().ok_or_else(|| {
            I32HostImportError::new(
                I32HostImportErrorCode::ResourceLimit,
                "Wasmi concurrent Store limit exhausted",
            )
        })?;
        self.module.invoke_i32(bindings, export, argument)
    }

    /// Invoke one zero-to-eight-parameter i32 scalar export with fresh
    /// request-local engine state.
    pub fn invoke_i32s(
        &self,
        bindings: &[I32HostBinding],
        export: &str,
        arguments: &[i32],
    ) -> Result<i32, I32HostImportError> {
        let _permit = self.admission.try_acquire().ok_or_else(|| {
            I32HostImportError::new(
                I32HostImportErrorCode::ResourceLimit,
                "Wasmi concurrent Store limit exhausted",
            )
        })?;
        self.module.invoke_i32s(bindings, export, arguments)
    }
}
