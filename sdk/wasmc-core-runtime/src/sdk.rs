//! Stable facade over completion and promotion mechanics.

use std::time::Duration;

use crate::{
    CoreModuleInspection, CoreRuntimeCancellation, CoreRuntimeLimitProfile, CoreScalarHostImport,
    CoreScalarHostSession, CoreScalarValue, I32HostBinding, I32HostImport, I32LaneHostBinding,
    I32LaneHostImport, I32LaneHostSession, PromotionArtifact, PromotionArtifactIdentity,
    PromotionBackend, PromotionConfig, PromotionDecision, PromotionError, PromotionInvocation,
    PromotionInvocationError, PromotionInvocationErrorCode, PromotionPolicyFingerprint,
    PromotionRuntime, PromotionRuntimeStatus, PromotionScalarInvocation, PromotionScalarOutcome,
    PromotionState, PromotionStatus,
};

pub type CoreRuntimePolicyFingerprint = PromotionPolicyFingerprint;
pub type CoreRuntimeArtifactIdentity = PromotionArtifactIdentity;
pub type CoreRuntimeBackend = PromotionBackend;
pub type CoreRuntimeOptimizationDecision = PromotionDecision;
pub type CoreRuntimeArtifactStatus = PromotionStatus;
pub type CoreRuntimeArtifactState = PromotionState;
pub type CoreRuntimeSdkStatus = PromotionRuntimeStatus;
pub type CoreRuntimeInvocation = PromotionInvocation;
pub type CoreRuntimeScalarInvocation = PromotionScalarInvocation;
pub type CoreRuntimeScalarOutcome<S> = PromotionScalarOutcome<S>;
pub type CoreRuntimeInvocationError = PromotionInvocationError;
pub type CoreRuntimeInvocationErrorCode = PromotionInvocationErrorCode;
pub type CoreRuntimeError = PromotionError;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CoreRuntimeSdkConfig {
    pub max_artifacts: usize,
    pub compile_queue_capacity: usize,
    pub limits: CoreRuntimeLimitProfile,
}

impl CoreRuntimeSdkConfig {
    pub const fn new(max_artifacts: usize, compile_queue_capacity: usize) -> Self {
        Self {
            max_artifacts,
            compile_queue_capacity,
            limits: CoreRuntimeLimitProfile::unbounded(),
        }
    }

    pub const fn with_limits(mut self, limits: CoreRuntimeLimitProfile) -> Self {
        self.limits = limits;
        self
    }
}

impl Default for CoreRuntimeSdkConfig {
    fn default() -> Self {
        Self::new(64, 8)
    }
}

pub struct CoreRuntimeSdk {
    runtime: PromotionRuntime,
}

impl CoreRuntimeSdk {
    pub fn new(config: CoreRuntimeSdkConfig) -> Result<Self, CoreRuntimeError> {
        PromotionRuntime::new_with_limits(
            PromotionConfig::new(config.max_artifacts, config.compile_queue_capacity),
            config.limits,
        )
        .map(|runtime| Self { runtime })
    }

    /// Validate and inspect Core bytes through the completion engine only.
    pub fn inspect_core(&self, wasm: &[u8]) -> Result<CoreModuleInspection, CoreRuntimeError> {
        self.runtime.inspect_core(wasm)
    }

    pub fn prepare_core(
        &self,
        wasm: &[u8],
        policy: CoreRuntimePolicyFingerprint,
    ) -> Result<CoreRuntimeArtifact, CoreRuntimeError> {
        self.runtime
            .prepare(wasm, policy)
            .map(CoreRuntimeArtifact::new)
    }

    pub fn prepare_i32_host_core(
        &self,
        wasm: &[u8],
        policy: CoreRuntimePolicyFingerprint,
        reviewed_imports: &[I32HostImport],
    ) -> Result<CoreRuntimeArtifact, CoreRuntimeError> {
        self.runtime
            .prepare_i32_host(wasm, policy, reviewed_imports)
            .map(CoreRuntimeArtifact::new)
    }

    pub fn prepare_i32_lane_host_core(
        &self,
        wasm: &[u8],
        policy: CoreRuntimePolicyFingerprint,
        reviewed_imports: &[I32LaneHostImport],
    ) -> Result<CoreRuntimeArtifact, CoreRuntimeError> {
        self.runtime
            .prepare_i32_lane_host(wasm, policy, reviewed_imports)
            .map(CoreRuntimeArtifact::new)
    }

    pub fn prepare_scalar_host_core(
        &self,
        wasm: &[u8],
        policy: CoreRuntimePolicyFingerprint,
        reviewed_imports: &[CoreScalarHostImport],
    ) -> Result<CoreRuntimeArtifact, CoreRuntimeError> {
        self.runtime
            .prepare_scalar_host(wasm, policy, reviewed_imports)
            .map(CoreRuntimeArtifact::new)
    }

    pub fn request_optimization(
        &self,
        artifact: &CoreRuntimeArtifact,
    ) -> Result<bool, CoreRuntimeError> {
        self.runtime.request_promotion(&artifact.artifact)
    }

    pub fn status(&self) -> CoreRuntimeSdkStatus {
        self.runtime.status()
    }
}

impl Default for CoreRuntimeSdk {
    fn default() -> Self {
        Self::new(CoreRuntimeSdkConfig::default())
            .expect("default Core Runtime SDK configuration must be valid")
    }
}

#[derive(Clone)]
pub struct CoreRuntimeArtifact {
    artifact: PromotionArtifact,
}

impl CoreRuntimeArtifact {
    fn new(artifact: PromotionArtifact) -> Self {
        Self { artifact }
    }

    pub fn identity(&self) -> CoreRuntimeArtifactIdentity {
        self.artifact.identity()
    }

    pub fn status(&self) -> CoreRuntimeArtifactStatus {
        self.artifact.status()
    }

    pub fn wait_for_optimization(&self, timeout: Duration) -> CoreRuntimeArtifactStatus {
        self.artifact.wait_for_compile(timeout)
    }

    pub fn publish(
        &self,
        decision: CoreRuntimeOptimizationDecision,
    ) -> Result<bool, CoreRuntimeError> {
        self.artifact.publish(decision)
    }

    pub fn cancel_optimization(&self) -> bool {
        self.artifact.cancel()
    }

    pub fn rollback_to_completion(&self) -> bool {
        self.artifact.rollback()
    }

    pub fn invoke_i32(
        &self,
        export: &str,
        argument: i32,
    ) -> Result<CoreRuntimeInvocation, CoreRuntimeInvocationError> {
        self.artifact.invoke_i32(export, argument)
    }

    pub fn invoke_i32_with_host(
        &self,
        bindings: &[I32HostBinding],
        export: &str,
        argument: i32,
    ) -> Result<CoreRuntimeInvocation, CoreRuntimeInvocationError> {
        self.artifact
            .invoke_i32_with_host(bindings, export, argument)
    }

    pub fn invoke_i32_lane_with_host(
        &self,
        bindings: Vec<I32LaneHostBinding>,
        export: &str,
        arguments: &[i32],
    ) -> Result<CoreRuntimeInvocation, CoreRuntimeInvocationError> {
        self.artifact
            .invoke_i32_lane_with_host(bindings, export, arguments)
    }

    pub fn invoke_i32_lane_with_session<S>(
        &self,
        session: I32LaneHostSession<S>,
        export: &str,
        arguments: &[i32],
    ) -> Result<CoreRuntimeInvocation, CoreRuntimeInvocationError>
    where
        S: Send + 'static,
    {
        self.artifact
            .invoke_i32_lane_with_session(session, export, arguments)
    }

    pub fn invoke_scalar_with_session<S>(
        &self,
        session: CoreScalarHostSession<S>,
        export: &str,
        arguments: &[CoreScalarValue],
    ) -> Result<CoreRuntimeScalarInvocation, CoreRuntimeInvocationError>
    where
        S: Send + 'static,
    {
        self.artifact
            .invoke_scalar_with_session(session, export, arguments)
    }

    pub fn invoke_scalar_with_session_state<S>(
        &self,
        session: CoreScalarHostSession<S>,
        export: &str,
        arguments: &[CoreScalarValue],
    ) -> CoreRuntimeScalarOutcome<S>
    where
        S: Send + 'static,
    {
        self.artifact
            .invoke_scalar_with_session_state(session, export, arguments)
    }

    pub fn invoke_scalar_with_session_state_and_cancellation<S>(
        &self,
        session: CoreScalarHostSession<S>,
        export: &str,
        arguments: &[CoreScalarValue],
        cancellation: &CoreRuntimeCancellation,
    ) -> CoreRuntimeScalarOutcome<S>
    where
        S: Send + 'static,
    {
        self.artifact
            .invoke_scalar_with_session_state_and_cancellation(
                session,
                export,
                arguments,
                cancellation,
            )
    }
}
