//! Host-owned bounded asynchronous promotion from Wasmi completion to Wasmtime reuse.
//!
//! [`PromotionRuntime::prepare`] synchronously admits and compiles one exact,
//! import-free Core module with Wasmi. It never waits for Wasmtime. The Host may
//! later request one coalesced background Wasmtime compile. A completed compile
//! remains an invisible candidate until the Host supplies explicit parity and
//! benefit evidence through [`PromotionArtifact::publish`]. Route selection is
//! snapshotted once per fresh invocation, and a trapped call is never retried on
//! the other backend.

use std::{
    collections::HashMap,
    error::Error,
    fmt,
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        mpsc::{sync_channel, Receiver, SyncSender, TrySendError},
        Arc, Condvar, Mutex, MutexGuard,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use crate::{
    host_import::{I32HostBinding, I32HostImport, WasmiI32HostModule, WasmtimeI32HostModule},
    host_lane::{
        ErasedLaneSession, I32LaneHostBinding, I32LaneHostImport, I32LaneHostSession,
        WasmiI32LaneHostModule, WasmtimeI32LaneHostModule,
    },
    limits::{is_resource_limit_message, ConcurrentStoreAdmission},
    scalar_host_lane::{
        CoreScalarHostImport, CoreScalarHostSession, CoreScalarValue, WasmiScalarHostModule,
        WasmtimeScalarHostModule,
    },
    sha256, CoreModuleInspection, CoreRuntimeCancellation, CoreRuntimeLimitProfile,
    WasmiCompletionModule, WasmiCompletionRuntime, WasmtimeSpeedModule, WasmtimeSpeedRuntime,
};

static NEXT_RUNTIME_ID: AtomicU64 = AtomicU64::new(1);

/// Host-computed digest of capability, limit, binding, target, and engine policy.
///
/// The promotion layer treats these bytes as an opaque exact identity. The Host
/// remains responsible for deriving them from its reviewed policy fields.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub struct PromotionPolicyFingerprint([u8; 32]);

impl PromotionPolicyFingerprint {
    pub const fn new(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    pub const fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

/// Exact cache and route identity for one reviewed artifact under one Host policy.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub struct PromotionArtifactIdentity {
    wasm_sha256: [u8; 32],
    policy_fingerprint: PromotionPolicyFingerprint,
    limit_profile: CoreRuntimeLimitProfile,
}

impl PromotionArtifactIdentity {
    pub const fn wasm_sha256(&self) -> &[u8; 32] {
        &self.wasm_sha256
    }

    pub const fn policy_fingerprint(&self) -> PromotionPolicyFingerprint {
        self.policy_fingerprint
    }

    pub const fn limit_profile(&self) -> CoreRuntimeLimitProfile {
        self.limit_profile
    }
}

/// Fixed bounds for one Host-owned promotion runtime.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PromotionConfig {
    pub max_artifacts: usize,
    pub queue_capacity: usize,
}

impl PromotionConfig {
    pub const fn new(max_artifacts: usize, queue_capacity: usize) -> Self {
        Self {
            max_artifacts,
            queue_capacity,
        }
    }
}

impl Default for PromotionConfig {
    fn default() -> Self {
        Self::new(64, 8)
    }
}

/// Stable failure classification for Host integration.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PromotionErrorCode {
    InvalidConfig,
    WasmiAdmission,
    DigestCollision,
    ForeignArtifact,
    WorkerUnavailable,
    InvalidState,
}

/// Promotion control-plane error. Invocation failures use a separate type.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PromotionError {
    code: PromotionErrorCode,
    message: String,
}

impl PromotionError {
    fn new(code: PromotionErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub const fn code(&self) -> PromotionErrorCode {
        self.code
    }

    #[doc(hidden)]
    pub fn worker_unavailable(message: impl Into<String>) -> Self {
        Self::new(PromotionErrorCode::WorkerUnavailable, message)
    }
}

impl fmt::Display for PromotionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl Error for PromotionError {}

/// Backend selected once at a fresh stateless invocation boundary.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PromotionBackend {
    Wasmi,
    Wasmtime,
}

/// Public state of one exact artifact entry.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PromotionState {
    Deferred,
    Queued,
    Compiling,
    Candidate,
    Ready,
    Failed,
    Declined,
    Cancelled,
    RolledBack,
    UntrackedCapacity,
}

/// Host evidence required before a compiled candidate can become a route.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PromotionDecision {
    pub behavior_parity: bool,
    pub resource_parity: bool,
    pub predicted_remaining_savings_ns: u64,
    pub contention_and_margin_ns: u64,
}

/// Snapshot of one artifact's control-plane and invocation observations.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PromotionStatus {
    pub identity: PromotionArtifactIdentity,
    pub state: PromotionState,
    pub route_generation: u64,
    pub wasmi_invocations: u64,
    pub wasmtime_invocations: u64,
    pub wasmtime_compile_ns: Option<u64>,
    pub failure: Option<String>,
}

/// Snapshot of bounded runtime-wide resources and compile counts.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PromotionRuntimeStatus {
    pub cached_artifacts: usize,
    pub queue_depth: usize,
    pub active_workers: usize,
    pub wasmi_compile_count: u64,
    pub wasmi_inspection_count: u64,
    pub wasmtime_compile_count: u64,
}

/// Successful result from one fresh request-local invocation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PromotionInvocation {
    pub backend: PromotionBackend,
    pub route_generation: u64,
    pub value: i32,
}

/// Successful flat-scalar invocation observation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PromotionScalarInvocation {
    pub backend: PromotionBackend,
    pub route_generation: u64,
    pub values: Vec<CoreScalarValue>,
}

/// One scalar invocation result together with its recovered request-local Host state.
pub struct PromotionScalarOutcome<S> {
    pub invocation: Result<PromotionScalarInvocation, PromotionInvocationError>,
    pub state: S,
}

/// Runtime error from one selected backend. No fallback or replay was attempted.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PromotionInvocationError {
    pub backend: PromotionBackend,
    pub route_generation: u64,
    code: PromotionInvocationErrorCode,
    message: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PromotionInvocationErrorCode {
    Invocation,
    ResourceLimit,
    Cancelled,
}

impl PromotionInvocationError {
    pub const fn code(&self) -> PromotionInvocationErrorCode {
        self.code
    }
}

impl fmt::Display for PromotionInvocationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl Error for PromotionInvocationError {}

enum PreparedWasmiModule {
    ImportFree(Arc<WasmiCompletionModule>),
    I32Host(Arc<WasmiI32HostModule>),
    I32LaneHost(Arc<WasmiI32LaneHostModule>),
    ScalarHost(Arc<WasmiScalarHostModule>),
}

impl PreparedWasmiModule {
    fn matches_plan(&self, plan: HostPlan<'_>) -> bool {
        match self {
            Self::ImportFree(_) => matches!(plan, HostPlan::ImportFree),
            Self::I32Host(module) => {
                matches!(plan, HostPlan::I32(imports) if module.imports() == imports)
            }
            Self::I32LaneHost(module) => {
                matches!(plan, HostPlan::I32Lane(imports) if module.imports() == imports)
            }
            Self::ScalarHost(module) => {
                matches!(plan, HostPlan::Scalar(imports) if module.imports() == imports)
            }
        }
    }
}

enum PreparedWasmtimeModule {
    ImportFree(Arc<WasmtimeSpeedModule>),
    I32Host(Arc<WasmtimeI32HostModule>),
    I32LaneHost(Arc<WasmtimeI32LaneHostModule>),
    ScalarHost(Arc<WasmtimeScalarHostModule>),
}

#[derive(Clone, Copy)]
enum HostPlan<'a> {
    ImportFree,
    I32(&'a [I32HostImport]),
    I32Lane(&'a [I32LaneHostImport]),
    Scalar(&'a [CoreScalarHostImport]),
}

enum EntryState {
    Deferred,
    Queued,
    Compiling,
    Candidate {
        module: Arc<PreparedWasmtimeModule>,
        compile_ns: u64,
    },
    Ready {
        module: Arc<PreparedWasmtimeModule>,
        compile_ns: u64,
    },
    Failed {
        message: String,
    },
    Declined {
        compile_ns: u64,
        reason: String,
    },
    Cancelled,
    RolledBack,
    UntrackedCapacity,
}

struct ArtifactEntry {
    runtime_id: u64,
    identity: PromotionArtifactIdentity,
    wasm: Arc<[u8]>,
    wasmi: PreparedWasmiModule,
    state: Mutex<EntryState>,
    changed: Condvar,
    route_generation: AtomicU64,
    wasmi_invocations: AtomicU64,
    wasmtime_invocations: AtomicU64,
    store_admission: Arc<ConcurrentStoreAdmission>,
}

impl ArtifactEntry {
    fn state(&self) -> MutexGuard<'_, EntryState> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn status(&self) -> PromotionStatus {
        let state = self.state();
        let (public_state, compile_ns, failure) = match &*state {
            EntryState::Deferred => (PromotionState::Deferred, None, None),
            EntryState::Queued => (PromotionState::Queued, None, None),
            EntryState::Compiling => (PromotionState::Compiling, None, None),
            EntryState::Candidate { compile_ns, .. } => {
                (PromotionState::Candidate, Some(*compile_ns), None)
            }
            EntryState::Ready { compile_ns, .. } => {
                (PromotionState::Ready, Some(*compile_ns), None)
            }
            EntryState::Failed { message } => (PromotionState::Failed, None, Some(message.clone())),
            EntryState::Declined { compile_ns, reason } => (
                PromotionState::Declined,
                Some(*compile_ns),
                Some(reason.clone()),
            ),
            EntryState::Cancelled => (PromotionState::Cancelled, None, None),
            EntryState::RolledBack => (PromotionState::RolledBack, None, None),
            EntryState::UntrackedCapacity => (PromotionState::UntrackedCapacity, None, None),
        };
        PromotionStatus {
            identity: self.identity,
            state: public_state,
            route_generation: self.route_generation.load(Ordering::Acquire),
            wasmi_invocations: self.wasmi_invocations.load(Ordering::Relaxed),
            wasmtime_invocations: self.wasmtime_invocations.load(Ordering::Relaxed),
            wasmtime_compile_ns: compile_ns,
            failure,
        }
    }
}

struct WorkerStats {
    queue_depth: AtomicUsize,
    active_workers: AtomicUsize,
    shutdown: AtomicBool,
}

/// One Host-owned lifecycle for exact artifact admission, caching, and promotion.
pub struct PromotionRuntime {
    id: u64,
    config: PromotionConfig,
    limits: CoreRuntimeLimitProfile,
    store_admission: Arc<ConcurrentStoreAdmission>,
    wasmi: WasmiCompletionRuntime,
    wasmtime: WasmtimeSpeedRuntime,
    catalog: Mutex<HashMap<PromotionArtifactIdentity, Arc<ArtifactEntry>>>,
    sender: Option<SyncSender<Arc<ArtifactEntry>>>,
    worker: Option<JoinHandle<()>>,
    worker_stats: Arc<WorkerStats>,
}

impl PromotionRuntime {
    pub fn new(config: PromotionConfig) -> Result<Self, PromotionError> {
        Self::new_with_limits(config, CoreRuntimeLimitProfile::unbounded())
    }

    pub fn new_with_limits(
        config: PromotionConfig,
        limits: CoreRuntimeLimitProfile,
    ) -> Result<Self, PromotionError> {
        if config.max_artifacts == 0 || config.queue_capacity == 0 {
            return Err(PromotionError::new(
                PromotionErrorCode::InvalidConfig,
                "promotion max_artifacts and queue_capacity must both be positive",
            ));
        }
        limits
            .validate()
            .map_err(|message| PromotionError::new(PromotionErrorCode::InvalidConfig, message))?;
        let wasmi = WasmiCompletionRuntime::new_with_limits(limits);
        let wasmtime = WasmtimeSpeedRuntime::new_with_limits(limits).map_err(|error| {
            PromotionError::new(
                PromotionErrorCode::WorkerUnavailable,
                format!("create Wasmtime promotion engine: {error}"),
            )
        })?;
        let (sender, receiver) = sync_channel(config.queue_capacity);
        let worker_stats = Arc::new(WorkerStats {
            queue_depth: AtomicUsize::new(0),
            active_workers: AtomicUsize::new(0),
            shutdown: AtomicBool::new(false),
        });
        let worker_runtime = wasmtime.clone();
        let worker_observations = Arc::clone(&worker_stats);
        let worker = thread::Builder::new()
            .name("wasmc-wasmtime-promotion".to_string())
            .spawn(move || promotion_worker(receiver, worker_runtime, worker_observations))
            .map_err(|error| {
                PromotionError::new(
                    PromotionErrorCode::WorkerUnavailable,
                    format!("start Wasmtime promotion worker: {error}"),
                )
            })?;
        let store_admission = Arc::new(ConcurrentStoreAdmission::new(limits));
        Ok(Self {
            id: NEXT_RUNTIME_ID.fetch_add(1, Ordering::Relaxed),
            config,
            limits,
            store_admission,
            wasmi,
            wasmtime,
            catalog: Mutex::new(HashMap::new()),
            sender: Some(sender),
            worker: Some(worker),
            worker_stats,
        })
    }

    /// Validate and describe Core bytes without constructing a Wasmtime module.
    pub fn inspect_core(&self, wasm: &[u8]) -> Result<CoreModuleInspection, PromotionError> {
        self.wasmi.inspect_wasm(wasm).map_err(|error| {
            PromotionError::new(
                PromotionErrorCode::WasmiAdmission,
                format!("Wasmi module inspection failed: {error}"),
            )
        })
    }

    /// Admit and compile with Wasmi only. No Wasmtime work is requested here.
    pub fn prepare(
        &self,
        wasm: &[u8],
        policy_fingerprint: PromotionPolicyFingerprint,
    ) -> Result<PromotionArtifact, PromotionError> {
        self.prepare_inner(wasm, policy_fingerprint, HostPlan::ImportFree)
    }

    /// Admit one exact synchronous `(i32)->i32` Host-import plan with Wasmi.
    ///
    /// The plan is data-only and grants no capability. Request-local callbacks
    /// are supplied only to the backend selected by a later invocation.
    pub fn prepare_i32_host(
        &self,
        wasm: &[u8],
        policy_fingerprint: PromotionPolicyFingerprint,
        reviewed_imports: &[I32HostImport],
    ) -> Result<PromotionArtifact, PromotionError> {
        self.prepare_inner(wasm, policy_fingerprint, HostPlan::I32(reviewed_imports))
    }

    /// Admit a variable-arity i32 Host lane with checked guest memory access.
    pub fn prepare_i32_lane_host(
        &self,
        wasm: &[u8],
        policy_fingerprint: PromotionPolicyFingerprint,
        reviewed_imports: &[I32LaneHostImport],
    ) -> Result<PromotionArtifact, PromotionError> {
        self.prepare_inner(
            wasm,
            policy_fingerprint,
            HostPlan::I32Lane(reviewed_imports),
        )
    }

    /// Admit one exact WIT/Core flat-scalar Host lane.
    pub fn prepare_scalar_host(
        &self,
        wasm: &[u8],
        policy_fingerprint: PromotionPolicyFingerprint,
        reviewed_imports: &[CoreScalarHostImport],
    ) -> Result<PromotionArtifact, PromotionError> {
        self.prepare_inner(wasm, policy_fingerprint, HostPlan::Scalar(reviewed_imports))
    }

    fn prepare_inner(
        &self,
        wasm: &[u8],
        policy_fingerprint: PromotionPolicyFingerprint,
        plan: HostPlan<'_>,
    ) -> Result<PromotionArtifact, PromotionError> {
        let identity = PromotionArtifactIdentity {
            wasm_sha256: sha256(wasm),
            policy_fingerprint,
            limit_profile: self.limits,
        };
        let mut catalog = self
            .catalog
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(entry) = catalog.get(&identity) {
            if entry.wasm.as_ref() != wasm {
                return Err(PromotionError::new(
                    PromotionErrorCode::DigestCollision,
                    "artifact SHA-256 and policy identity matched different exact Core bytes",
                ));
            }
            if !entry.wasmi.matches_plan(plan) {
                return Err(PromotionError::new(
                    PromotionErrorCode::DigestCollision,
                    "artifact identity matched a different exact Host import plan",
                ));
            }
            return Ok(PromotionArtifact {
                entry: Arc::clone(entry),
            });
        }

        let wasmi = match plan {
            HostPlan::ImportFree => PreparedWasmiModule::ImportFree(Arc::new(
                self.wasmi.compile_wasm(wasm).map_err(|error| {
                    PromotionError::new(
                        PromotionErrorCode::WasmiAdmission,
                        format!("Wasmi common admission failed: {error}"),
                    )
                })?,
            )),
            HostPlan::I32(imports) => PreparedWasmiModule::I32Host(Arc::new(
                WasmiI32HostModule::compile(&self.wasmi, wasm, imports).map_err(|error| {
                    PromotionError::new(
                        PromotionErrorCode::WasmiAdmission,
                        format!("Wasmi Host-import admission failed: {error}"),
                    )
                })?,
            )),
            HostPlan::I32Lane(imports) => PreparedWasmiModule::I32LaneHost(Arc::new(
                WasmiI32LaneHostModule::compile(&self.wasmi, wasm, imports).map_err(|error| {
                    PromotionError::new(
                        PromotionErrorCode::WasmiAdmission,
                        format!("Wasmi i32-lane Host admission failed: {error}"),
                    )
                })?,
            )),
            HostPlan::Scalar(imports) => PreparedWasmiModule::ScalarHost(Arc::new(
                WasmiScalarHostModule::compile(&self.wasmi, wasm, imports).map_err(|error| {
                    PromotionError::new(
                        PromotionErrorCode::WasmiAdmission,
                        format!("Wasmi scalar Host admission failed: {error}"),
                    )
                })?,
            )),
        };
        let tracked = catalog.len() < self.config.max_artifacts;
        let entry = Arc::new(ArtifactEntry {
            runtime_id: self.id,
            identity,
            wasm: Arc::from(wasm),
            wasmi,
            state: Mutex::new(if tracked {
                EntryState::Deferred
            } else {
                EntryState::UntrackedCapacity
            }),
            changed: Condvar::new(),
            route_generation: AtomicU64::new(0),
            wasmi_invocations: AtomicU64::new(0),
            wasmtime_invocations: AtomicU64::new(0),
            store_admission: Arc::clone(&self.store_admission),
        });
        if tracked {
            catalog.insert(identity, Arc::clone(&entry));
        }
        Ok(PromotionArtifact { entry })
    }

    /// Request at most one compile flight for this exact runtime/artifact entry.
    ///
    /// `Ok(true)` means the request entered the bounded queue. `Ok(false)` means
    /// it was already queued, compiling, complete, terminal, or the queue is
    /// currently full. A later Host call may retry a still-deferred entry.
    pub fn request_promotion(&self, artifact: &PromotionArtifact) -> Result<bool, PromotionError> {
        self.require_owned(artifact)?;
        let sender = self.sender.as_ref().ok_or_else(|| {
            PromotionError::new(
                PromotionErrorCode::WorkerUnavailable,
                "promotion worker is unavailable",
            )
        })?;
        let mut state = artifact.entry.state();
        if !matches!(*state, EntryState::Deferred) {
            return Ok(false);
        }
        self.worker_stats
            .queue_depth
            .fetch_add(1, Ordering::Release);
        match sender.try_send(Arc::clone(&artifact.entry)) {
            Ok(()) => {
                *state = EntryState::Queued;
                artifact.entry.changed.notify_all();
                Ok(true)
            }
            Err(TrySendError::Full(_)) => {
                self.worker_stats.queue_depth.fetch_sub(1, Ordering::AcqRel);
                Ok(false)
            }
            Err(TrySendError::Disconnected(_)) => {
                self.worker_stats.queue_depth.fetch_sub(1, Ordering::AcqRel);
                Err(PromotionError::new(
                    PromotionErrorCode::WorkerUnavailable,
                    "promotion worker disconnected",
                ))
            }
        }
    }

    pub fn status(&self) -> PromotionRuntimeStatus {
        PromotionRuntimeStatus {
            cached_artifacts: self
                .catalog
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .len(),
            queue_depth: self.worker_stats.queue_depth.load(Ordering::Acquire),
            active_workers: self.worker_stats.active_workers.load(Ordering::Acquire),
            wasmi_compile_count: self.wasmi.compile_count(),
            wasmi_inspection_count: self.wasmi.inspection_count(),
            wasmtime_compile_count: self.wasmtime.compile_count(),
        }
    }

    fn require_owned(&self, artifact: &PromotionArtifact) -> Result<(), PromotionError> {
        if artifact.entry.runtime_id == self.id {
            Ok(())
        } else {
            Err(PromotionError::new(
                PromotionErrorCode::ForeignArtifact,
                "promotion artifact belongs to a different Host runtime",
            ))
        }
    }
}

impl Drop for PromotionRuntime {
    fn drop(&mut self) {
        self.worker_stats.shutdown.store(true, Ordering::Release);
        self.sender.take();
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

/// Cloneable exact artifact handle. It contains no Store, Instance, or live resource.
#[derive(Clone)]
pub struct PromotionArtifact {
    entry: Arc<ArtifactEntry>,
}

impl PromotionArtifact {
    pub fn identity(&self) -> PromotionArtifactIdentity {
        self.entry.identity
    }

    pub fn status(&self) -> PromotionStatus {
        self.entry.status()
    }

    /// Wait until the compile flight reaches Candidate or another terminal state.
    pub fn wait_for_compile(&self, timeout: Duration) -> PromotionStatus {
        let deadline = Instant::now() + timeout;
        let mut state = self.entry.state();
        while matches!(*state, EntryState::Queued | EntryState::Compiling) {
            let now = Instant::now();
            if now >= deadline {
                break;
            }
            let remaining = deadline.saturating_duration_since(now);
            let waited = self.entry.changed.wait_timeout(state, remaining);
            state = match waited {
                Ok((guard, _)) => guard,
                Err(poisoned) => poisoned.into_inner().0,
            };
        }
        drop(state);
        self.status()
    }

    /// Atomically publish a complete candidate only after positive Host evidence.
    pub fn publish(&self, decision: PromotionDecision) -> Result<bool, PromotionError> {
        let mut state = self.entry.state();
        let EntryState::Candidate { module, compile_ns } = &*state else {
            return Err(PromotionError::new(
                PromotionErrorCode::InvalidState,
                "only a complete Wasmtime candidate can be published",
            ));
        };
        let module = Arc::clone(module);
        let compile_ns = *compile_ns;
        let required_ns = compile_ns.saturating_add(decision.contention_and_margin_ns);
        if decision.behavior_parity
            && decision.resource_parity
            && decision.predicted_remaining_savings_ns > required_ns
        {
            self.entry.route_generation.fetch_add(1, Ordering::AcqRel);
            *state = EntryState::Ready { module, compile_ns };
            self.entry.changed.notify_all();
            Ok(true)
        } else {
            *state = EntryState::Declined {
                compile_ns,
                reason: "Host parity or positive-benefit decision rejected promotion".to_string(),
            };
            self.entry.changed.notify_all();
            Ok(false)
        }
    }

    /// Cancel queued, compiling, or complete-unpublished optimization work.
    ///
    /// Compilation already executing inside Cranelift is cooperatively discarded
    /// after it returns; this v0 does not claim preemptive hostile-tenant control.
    pub fn cancel(&self) -> bool {
        let mut state = self.entry.state();
        if matches!(
            *state,
            EntryState::Deferred
                | EntryState::Queued
                | EntryState::Compiling
                | EntryState::Candidate { .. }
        ) {
            *state = EntryState::Cancelled;
            self.entry.changed.notify_all();
            true
        } else {
            false
        }
    }

    /// Atomically route future calls back to Wasmi and discard any candidate.
    pub fn rollback(&self) -> bool {
        let mut state = self.entry.state();
        if matches!(
            *state,
            EntryState::Queued
                | EntryState::Compiling
                | EntryState::Candidate { .. }
                | EntryState::Ready { .. }
        ) {
            self.entry.route_generation.fetch_add(1, Ordering::AcqRel);
            *state = EntryState::RolledBack;
            self.entry.changed.notify_all();
            true
        } else {
            false
        }
    }

    /// Run one fresh request-local `i32 -> i32` invocation.
    ///
    /// The route is snapshotted before instantiation. Any trap is returned from
    /// that backend exactly once; there is no fallback or effect replay.
    pub fn invoke_i32(
        &self,
        export: &str,
        argument: i32,
    ) -> Result<PromotionInvocation, PromotionInvocationError> {
        let (wasmtime, generation) = {
            let state = self.entry.state();
            let generation = self.entry.route_generation.load(Ordering::Acquire);
            let module = match &*state {
                EntryState::Ready { module, .. } => Some(Arc::clone(module)),
                _ => None,
            };
            (module, generation)
        };
        let _permit = self.acquire_store(if wasmtime.is_some() {
            PromotionBackend::Wasmtime
        } else {
            PromotionBackend::Wasmi
        })?;
        if let Some(module) = wasmtime {
            self.entry
                .wasmtime_invocations
                .fetch_add(1, Ordering::Relaxed);
            let result = match module.as_ref() {
                PreparedWasmtimeModule::ImportFree(module) => module
                    .invoke_i32(export, argument)
                    .map_err(|error| format!("{error:#}")),
                PreparedWasmtimeModule::I32Host(_) => {
                    Err("artifact requires exact request-local Host bindings".to_string())
                }
                PreparedWasmtimeModule::I32LaneHost(_) => {
                    Err("artifact requires exact request-local i32-lane Host bindings".to_string())
                }
                PreparedWasmtimeModule::ScalarHost(_) => {
                    Err("artifact requires exact request-local scalar Host bindings".to_string())
                }
            };
            result
                .map(|value| PromotionInvocation {
                    backend: PromotionBackend::Wasmtime,
                    route_generation: generation,
                    value,
                })
                .map_err(|error| PromotionInvocationError {
                    backend: PromotionBackend::Wasmtime,
                    route_generation: generation,
                    code: classify_invocation_error(&error),
                    message: format!("Wasmtime invocation failed without replay: {error}"),
                })
        } else {
            self.entry.wasmi_invocations.fetch_add(1, Ordering::Relaxed);
            let result = match &self.entry.wasmi {
                PreparedWasmiModule::ImportFree(module) => module
                    .invoke_i32(export, argument)
                    .map_err(|error| error.to_string()),
                PreparedWasmiModule::I32Host(_) => {
                    Err("artifact requires exact request-local Host bindings".to_string())
                }
                PreparedWasmiModule::I32LaneHost(_) => {
                    Err("artifact requires exact request-local i32-lane Host bindings".to_string())
                }
                PreparedWasmiModule::ScalarHost(_) => {
                    Err("artifact requires exact request-local scalar Host bindings".to_string())
                }
            };
            result
                .map(|value| PromotionInvocation {
                    backend: PromotionBackend::Wasmi,
                    route_generation: generation,
                    value,
                })
                .map_err(|error| PromotionInvocationError {
                    backend: PromotionBackend::Wasmi,
                    route_generation: generation,
                    code: classify_invocation_error(&error),
                    message: format!("Wasmi invocation failed without replay: {error}"),
                })
        }
    }

    /// Run one fresh request-local invocation with an exact Host binding set.
    ///
    /// Route selection happens before Store construction. Only that selected
    /// backend receives callbacks, so a trap or binding failure is never
    /// retried, mirrored, or replayed on the other engine.
    pub fn invoke_i32_with_host(
        &self,
        bindings: &[I32HostBinding],
        export: &str,
        argument: i32,
    ) -> Result<PromotionInvocation, PromotionInvocationError> {
        let (wasmtime, generation) = {
            let state = self.entry.state();
            let generation = self.entry.route_generation.load(Ordering::Acquire);
            let module = match &*state {
                EntryState::Ready { module, .. } => Some(Arc::clone(module)),
                _ => None,
            };
            (module, generation)
        };
        let _permit = self.acquire_store(if wasmtime.is_some() {
            PromotionBackend::Wasmtime
        } else {
            PromotionBackend::Wasmi
        })?;
        if let Some(module) = wasmtime {
            self.entry
                .wasmtime_invocations
                .fetch_add(1, Ordering::Relaxed);
            let result = match module.as_ref() {
                PreparedWasmtimeModule::I32Host(module) => module
                    .invoke_i32(bindings, export, argument)
                    .map_err(|error| error.to_string()),
                PreparedWasmtimeModule::ImportFree(_) => {
                    Err("artifact has no reviewed Host import plan".to_string())
                }
                PreparedWasmtimeModule::I32LaneHost(_) => {
                    Err("artifact uses the i32-lane Host binding contract".to_string())
                }
                PreparedWasmtimeModule::ScalarHost(_) => {
                    Err("artifact uses the scalar Host binding contract".to_string())
                }
            };
            result
                .map(|value| PromotionInvocation {
                    backend: PromotionBackend::Wasmtime,
                    route_generation: generation,
                    value,
                })
                .map_err(|message| PromotionInvocationError {
                    backend: PromotionBackend::Wasmtime,
                    route_generation: generation,
                    code: classify_invocation_error(&message),
                    message: format!("Wasmtime Host invocation failed without replay: {message}"),
                })
        } else {
            self.entry.wasmi_invocations.fetch_add(1, Ordering::Relaxed);
            let result = match &self.entry.wasmi {
                PreparedWasmiModule::I32Host(module) => module
                    .invoke_i32(bindings, export, argument)
                    .map_err(|error| error.to_string()),
                PreparedWasmiModule::ImportFree(_) => {
                    Err("artifact has no reviewed Host import plan".to_string())
                }
                PreparedWasmiModule::I32LaneHost(_) => {
                    Err("artifact uses the i32-lane Host binding contract".to_string())
                }
                PreparedWasmiModule::ScalarHost(_) => {
                    Err("artifact uses the scalar Host binding contract".to_string())
                }
            };
            result
                .map(|value| PromotionInvocation {
                    backend: PromotionBackend::Wasmi,
                    route_generation: generation,
                    value,
                })
                .map_err(|message| PromotionInvocationError {
                    backend: PromotionBackend::Wasmi,
                    route_generation: generation,
                    code: classify_invocation_error(&message),
                    message: format!("Wasmi Host invocation failed without replay: {message}"),
                })
        }
    }

    /// Invoke an export through the exact variable-arity i32 Host lane.
    ///
    /// The callback set and route are snapshotted for this fresh Store only.
    /// A callback, memory, binding, or guest failure is never replayed.
    pub fn invoke_i32_lane_with_host(
        &self,
        bindings: Vec<I32LaneHostBinding>,
        export: &str,
        arguments: &[i32],
    ) -> Result<PromotionInvocation, PromotionInvocationError> {
        self.invoke_i32_lane_session(ErasedLaneSession::stateless(bindings), export, arguments)
    }

    /// Invoke with one typed mutable state shared by every Host binding.
    pub fn invoke_i32_lane_with_session<S>(
        &self,
        session: I32LaneHostSession<S>,
        export: &str,
        arguments: &[i32],
    ) -> Result<PromotionInvocation, PromotionInvocationError>
    where
        S: Send + 'static,
    {
        self.invoke_i32_lane_session(session.erase(), export, arguments)
    }

    fn invoke_i32_lane_session(
        &self,
        session: ErasedLaneSession,
        export: &str,
        arguments: &[i32],
    ) -> Result<PromotionInvocation, PromotionInvocationError> {
        let (wasmtime, generation) = {
            let state = self.entry.state();
            let generation = self.entry.route_generation.load(Ordering::Acquire);
            let module = match &*state {
                EntryState::Ready { module, .. } => Some(Arc::clone(module)),
                _ => None,
            };
            (module, generation)
        };
        let _permit = self.acquire_store(if wasmtime.is_some() {
            PromotionBackend::Wasmtime
        } else {
            PromotionBackend::Wasmi
        })?;
        if let Some(module) = wasmtime {
            self.entry
                .wasmtime_invocations
                .fetch_add(1, Ordering::Relaxed);
            let result = match module.as_ref() {
                PreparedWasmtimeModule::I32LaneHost(module) => module
                    .invoke(session, export, arguments)
                    .map_err(|error| error.to_string()),
                _ => Err("artifact does not use the i32-lane Host contract".to_string()),
            };
            result
                .map(|value| PromotionInvocation {
                    backend: PromotionBackend::Wasmtime,
                    route_generation: generation,
                    value,
                })
                .map_err(|message| PromotionInvocationError {
                    backend: PromotionBackend::Wasmtime,
                    route_generation: generation,
                    code: classify_invocation_error(&message),
                    message: format!(
                        "Wasmtime i32-lane Host invocation failed without replay: {message}"
                    ),
                })
        } else {
            self.entry.wasmi_invocations.fetch_add(1, Ordering::Relaxed);
            let result = match &self.entry.wasmi {
                PreparedWasmiModule::I32LaneHost(module) => module
                    .invoke(session, export, arguments)
                    .map_err(|error| error.to_string()),
                _ => Err("artifact does not use the i32-lane Host contract".to_string()),
            };
            result
                .map(|value| PromotionInvocation {
                    backend: PromotionBackend::Wasmi,
                    route_generation: generation,
                    value,
                })
                .map_err(|message| PromotionInvocationError {
                    backend: PromotionBackend::Wasmi,
                    route_generation: generation,
                    code: classify_invocation_error(&message),
                    message: format!(
                        "Wasmi i32-lane Host invocation failed without replay: {message}"
                    ),
                })
        }
    }

    /// Invoke one exact flat-scalar export with fresh typed Host state.
    pub fn invoke_scalar_with_session<S>(
        &self,
        session: CoreScalarHostSession<S>,
        export: &str,
        arguments: &[CoreScalarValue],
    ) -> Result<PromotionScalarInvocation, PromotionInvocationError>
    where
        S: Send + 'static,
    {
        self.invoke_scalar_with_session_state(session, export, arguments)
            .invocation
    }

    /// Invoke once and return the consumed typed Host state on success or failure.
    pub fn invoke_scalar_with_session_state<S>(
        &self,
        session: CoreScalarHostSession<S>,
        export: &str,
        arguments: &[CoreScalarValue],
    ) -> PromotionScalarOutcome<S>
    where
        S: Send + 'static,
    {
        self.invoke_scalar_with_session_state_and_cancellation(
            session,
            export,
            arguments,
            &CoreRuntimeCancellation::new(),
        )
    }

    /// Invoke once under a Host-owned cooperative cancellation signal.
    ///
    /// Bounded profiles observe in-flight cancellation at Wasmi fuel quanta
    /// and Wasmtime epoch ticks. Unbounded profiles observe it before and after
    /// execution because neither engine has an interrupt boundary to reuse.
    pub fn invoke_scalar_with_session_state_and_cancellation<S>(
        &self,
        session: CoreScalarHostSession<S>,
        export: &str,
        arguments: &[CoreScalarValue],
        cancellation: &CoreRuntimeCancellation,
    ) -> PromotionScalarOutcome<S>
    where
        S: Send + 'static,
    {
        let session = session.erase();
        let (wasmtime, generation) = {
            let state = self.entry.state();
            let generation = self.entry.route_generation.load(Ordering::Acquire);
            let module = match &*state {
                EntryState::Ready { module, .. } => Some(Arc::clone(module)),
                _ => None,
            };
            (module, generation)
        };
        let backend = if wasmtime.is_some() {
            PromotionBackend::Wasmtime
        } else {
            PromotionBackend::Wasmi
        };
        if cancellation.is_cancelled() {
            return PromotionScalarOutcome {
                invocation: Err(cancelled_invocation_error(backend, generation)),
                state: session.into_state(),
            };
        }
        let _permit = match self.acquire_store(backend) {
            Ok(permit) => permit,
            Err(error) => {
                return PromotionScalarOutcome {
                    invocation: Err(error),
                    state: session.into_state(),
                };
            }
        };
        let (result, state) = if let Some(module) = wasmtime {
            self.entry
                .wasmtime_invocations
                .fetch_add(1, Ordering::Relaxed);
            match module.as_ref() {
                PreparedWasmtimeModule::ScalarHost(module) => {
                    let (result, state) = module
                        .invoke_with_state(session, export, arguments, cancellation)
                        .into_typed();
                    (result.map_err(|error| error.to_string()), state)
                }
                _ => (
                    Err("artifact does not use the scalar Host contract".to_string()),
                    session.into_state(),
                ),
            }
        } else {
            self.entry.wasmi_invocations.fetch_add(1, Ordering::Relaxed);
            match &self.entry.wasmi {
                PreparedWasmiModule::ScalarHost(module) => {
                    let (result, state) = module
                        .invoke_with_state(session, export, arguments, cancellation)
                        .into_typed();
                    (result.map_err(|error| error.to_string()), state)
                }
                _ => (
                    Err("artifact does not use the scalar Host contract".to_string()),
                    session.into_state(),
                ),
            }
        };
        let invocation = result
            .map(|values| PromotionScalarInvocation {
                backend,
                route_generation: generation,
                values,
            })
            .map_err(|message| PromotionInvocationError {
                backend,
                route_generation: generation,
                code: if cancellation.is_cancelled() {
                    PromotionInvocationErrorCode::Cancelled
                } else {
                    classify_invocation_error(&message)
                },
                message: format!(
                    "{backend:?} scalar Host invocation failed without replay: {message}"
                ),
            });
        PromotionScalarOutcome { invocation, state }
    }

    fn acquire_store(
        &self,
        backend: PromotionBackend,
    ) -> Result<crate::limits::ConcurrentStorePermit<'_>, PromotionInvocationError> {
        self.entry
            .store_admission
            .try_acquire()
            .ok_or_else(|| PromotionInvocationError {
                backend,
                route_generation: self.entry.route_generation.load(Ordering::Acquire),
                code: PromotionInvocationErrorCode::ResourceLimit,
                message: "Core invocation rejected before Store creation: concurrent Store limit exhausted"
                    .to_string(),
            })
    }
}

fn cancelled_invocation_error(
    backend: PromotionBackend,
    route_generation: u64,
) -> PromotionInvocationError {
    PromotionInvocationError {
        backend,
        route_generation,
        code: PromotionInvocationErrorCode::Cancelled,
        message: "Core invocation cancelled before Store creation".to_string(),
    }
}

fn classify_invocation_error(message: &str) -> PromotionInvocationErrorCode {
    if is_resource_limit_message(message) {
        PromotionInvocationErrorCode::ResourceLimit
    } else {
        PromotionInvocationErrorCode::Invocation
    }
}

fn promotion_worker(
    receiver: Receiver<Arc<ArtifactEntry>>,
    wasmtime: WasmtimeSpeedRuntime,
    stats: Arc<WorkerStats>,
) {
    while let Ok(entry) = receiver.recv() {
        stats.queue_depth.fetch_sub(1, Ordering::AcqRel);
        if stats.shutdown.load(Ordering::Acquire) {
            let mut state = entry.state();
            if matches!(*state, EntryState::Queued | EntryState::Compiling) {
                *state = EntryState::Cancelled;
                entry.changed.notify_all();
            }
            continue;
        }
        {
            let mut state = entry.state();
            if !matches!(*state, EntryState::Queued) {
                continue;
            }
            *state = EntryState::Compiling;
            entry.changed.notify_all();
        }
        stats.active_workers.store(1, Ordering::Release);
        let started = Instant::now();
        let compiled = match &entry.wasmi {
            PreparedWasmiModule::ImportFree(_) => wasmtime
                .compile_wasm(&entry.wasm)
                .map(|module| PreparedWasmtimeModule::ImportFree(Arc::new(module)))
                .map_err(|error| error.to_string()),
            PreparedWasmiModule::I32Host(module) => {
                WasmtimeI32HostModule::compile(&wasmtime, &entry.wasm, module.imports())
                    .map(|module| PreparedWasmtimeModule::I32Host(Arc::new(module)))
                    .map_err(|error| error.to_string())
            }
            PreparedWasmiModule::I32LaneHost(module) => {
                WasmtimeI32LaneHostModule::compile(&wasmtime, &entry.wasm, module.imports())
                    .map(|module| PreparedWasmtimeModule::I32LaneHost(Arc::new(module)))
                    .map_err(|error| error.to_string())
            }
            PreparedWasmiModule::ScalarHost(module) => {
                WasmtimeScalarHostModule::compile(&wasmtime, &entry.wasm, module.imports())
                    .map(|module| PreparedWasmtimeModule::ScalarHost(Arc::new(module)))
                    .map_err(|error| error.to_string())
            }
        };
        let compile_ns = u64::try_from(started.elapsed().as_nanos()).unwrap_or(u64::MAX);
        stats.active_workers.store(0, Ordering::Release);

        let mut state = entry.state();
        if !matches!(*state, EntryState::Compiling) {
            continue;
        }
        *state = match compiled {
            Ok(module) => EntryState::Candidate {
                module: Arc::new(module),
                compile_ns,
            },
            Err(error) => EntryState::Failed {
                message: format!("Wasmtime candidate compilation failed: {error}"),
            },
        };
        entry.changed.notify_all();
    }
}
