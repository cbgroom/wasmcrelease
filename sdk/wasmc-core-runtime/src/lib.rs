//! Compiler-independent dual-engine runtime SDK for WebAssembly Core.

#[cfg(feature = "wasmi-runtime")]
mod wasmi_runtime;
#[cfg(feature = "wasmtime-runtime")]
mod wasmtime_speed_runtime;

#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
mod host_import;
#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
mod host_lane;
#[cfg(any(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
mod limits;
#[cfg(feature = "wasmi-runtime")]
mod module_inspection;
#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
mod promotion;
#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
mod scalar_host_lane;
#[cfg(feature = "core-runtime-sdk")]
mod sdk;

#[cfg(feature = "wasmi-runtime")]
pub use wasmi_runtime::{WasmiCompletionInstance, WasmiCompletionModule, WasmiCompletionRuntime};
#[cfg(feature = "wasmtime-runtime")]
pub use wasmtime_speed_runtime::{
    WasmtimeSpeedInstance, WasmtimeSpeedModule, WasmtimeSpeedRuntime,
};

#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
pub use host_import::{I32HostBinding, I32HostImport, I32HostImportError, I32HostImportErrorCode};
#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
pub use host_lane::{
    I32LaneHostBinding, I32LaneHostError, I32LaneHostErrorCode, I32LaneHostImport,
    I32LaneHostSession, I32LaneMemory,
};
#[cfg(any(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
pub use limits::{CoreRuntimeCancellation, CoreRuntimeLimitProfile};
#[cfg(feature = "wasmi-runtime")]
pub use module_inspection::{
    CoreModuleExport, CoreModuleExternType, CoreModuleImport, CoreModuleInspection,
    CoreModuleValueType,
};
#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
pub use promotion::{
    PromotionArtifact, PromotionArtifactIdentity, PromotionBackend, PromotionConfig,
    PromotionDecision, PromotionError, PromotionErrorCode, PromotionInvocation,
    PromotionInvocationError, PromotionInvocationErrorCode, PromotionPolicyFingerprint,
    PromotionRuntime, PromotionRuntimeStatus, PromotionScalarInvocation, PromotionScalarOutcome,
    PromotionState, PromotionStatus,
};
#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
pub use scalar_host_lane::{
    CoreScalarHostError, CoreScalarHostErrorCode, CoreScalarHostImport, CoreScalarHostSession,
    CoreScalarMemory, CoreScalarType, CoreScalarValue,
};
#[cfg(feature = "core-runtime-sdk")]
pub use sdk::{
    CoreRuntimeArtifact, CoreRuntimeArtifactIdentity, CoreRuntimeArtifactState,
    CoreRuntimeArtifactStatus, CoreRuntimeBackend, CoreRuntimeError, CoreRuntimeInvocation,
    CoreRuntimeInvocationError, CoreRuntimeInvocationErrorCode, CoreRuntimeOptimizationDecision,
    CoreRuntimePolicyFingerprint, CoreRuntimeScalarInvocation, CoreRuntimeScalarOutcome,
    CoreRuntimeSdk, CoreRuntimeSdkConfig, CoreRuntimeSdkStatus,
};

#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
fn sha256(bytes: &[u8]) -> [u8; 32] {
    use sha2::{Digest, Sha256};
    Sha256::digest(bytes).into()
}
