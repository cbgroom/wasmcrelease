//! Public Rust embedding SDK for the generic WAsmC Host.
//!
//! Profiles are host-side policy only. They never add guest-visible Host
//! operations or application-specific capability families.

use std::{
    collections::BTreeMap,
    error::Error,
    fmt,
    fs::{File, OpenOptions},
    path::Path,
};

use wasmc_bounded_memory_reference::{BoundedMemory, MemoryError};
pub use wasmc_core_runtime::{
    CoreRuntimeArtifact, CoreRuntimeArtifactIdentity, CoreRuntimeBackend, CoreRuntimeCancellation,
    CoreRuntimeError, CoreRuntimeInvocation, CoreRuntimeInvocationError,
    CoreRuntimeInvocationErrorCode, CoreRuntimeLimitProfile, CoreRuntimeOptimizationDecision,
    CoreRuntimePolicyFingerprint, CoreRuntimeSdk, CoreRuntimeSdkConfig, CoreRuntimeSdkStatus,
};
use wasmc_preopened_file_reference::PreopenedFile;

const SAFE_SCRATCH_SELECTOR: &str = "wasmc.memory.scratch";
const SAFE_SCRATCH_BYTES: usize = 1024 * 1024;
const DEVELOPMENT_FILE_MAX_BYTES: usize = 64 * 1024;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HostPlatform {
    Linux,
    Macos,
    Windows,
    Other,
}

impl HostPlatform {
    pub const fn current() -> Self {
        if cfg!(target_os = "linux") {
            Self::Linux
        } else if cfg!(target_os = "macos") {
            Self::Macos
        } else if cfg!(target_os = "windows") {
            Self::Windows
        } else {
            Self::Other
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HostBindPolicy {
    Minimal,
    Safe,
    Development,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BindMode {
    BestEffort,
    Strict,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ResourceKind {
    File,
    Memory,
    Custom,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BindingOrigin {
    Automatic,
    Explicit,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BindingRecord {
    selector: String,
    kind: ResourceKind,
    origin: BindingOrigin,
}

impl BindingRecord {
    pub fn selector(&self) -> &str {
        &self.selector
    }

    pub const fn kind(&self) -> ResourceKind {
        self.kind
    }

    pub const fn origin(&self) -> BindingOrigin {
        self.origin
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BindingSkip {
    selector: String,
    reason: String,
}

impl BindingSkip {
    pub fn selector(&self) -> &str {
        &self.selector
    }

    pub fn reason(&self) -> &str {
        &self.reason
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BindingReport {
    platform: HostPlatform,
    policy: HostBindPolicy,
    bound: Vec<BindingRecord>,
    skipped: Vec<BindingSkip>,
    notes: Vec<String>,
}

impl BindingReport {
    fn new() -> Self {
        Self {
            platform: HostPlatform::current(),
            policy: HostBindPolicy::Minimal,
            bound: Vec::new(),
            skipped: Vec::new(),
            notes: Vec::new(),
        }
    }

    pub const fn platform(&self) -> HostPlatform {
        self.platform
    }

    pub const fn policy(&self) -> HostBindPolicy {
        self.policy
    }

    pub fn bound(&self) -> &[BindingRecord] {
        &self.bound
    }

    pub fn skipped(&self) -> &[BindingSkip] {
        &self.skipped
    }

    pub fn notes(&self) -> &[String] {
        &self.notes
    }
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct ResourceHandle(u32);

impl ResourceHandle {
    pub const fn raw(self) -> u32 {
        self.0
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HostErrorCode {
    InvalidSelector,
    DuplicateSelector,
    UnknownResource,
    PermissionDenied,
    Bounds,
    Unsupported,
    External,
    ResourceLimit,
    Runtime,
    AutoBind,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HostError {
    code: HostErrorCode,
    message: String,
}

impl HostError {
    pub fn new(code: HostErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub const fn code(&self) -> HostErrorCode {
        self.code
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

impl fmt::Display for HostError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl Error for HostError {}

pub trait ResourceBinding: Send {
    fn kind(&self) -> ResourceKind {
        ResourceKind::Custom
    }

    fn read(
        &mut self,
        _position: Option<u64>,
        _destination: &mut [u8],
    ) -> Result<usize, HostError> {
        Err(HostError::new(
            HostErrorCode::Unsupported,
            "resource does not support read",
        ))
    }

    fn write(&mut self, _position: Option<u64>, _source: &[u8]) -> Result<usize, HostError> {
        Err(HostError::new(
            HostErrorCode::Unsupported,
            "resource does not support write",
        ))
    }

    fn invoke(
        &mut self,
        _opcode: u32,
        _request: &[u8],
        _response: &mut [u8],
    ) -> Result<usize, HostError> {
        Err(HostError::new(
            HostErrorCode::Unsupported,
            "resource does not support invoke",
        ))
    }

    fn release(&mut self) -> Result<(), HostError>;
}

struct FileBinding {
    file: PreopenedFile,
}

impl ResourceBinding for FileBinding {
    fn kind(&self) -> ResourceKind {
        ResourceKind::File
    }

    fn read(&mut self, position: Option<u64>, destination: &mut [u8]) -> Result<usize, HostError> {
        let position = i64::try_from(position.unwrap_or(0))
            .map_err(|_| HostError::new(HostErrorCode::Bounds, "file position is too large"))?;
        self.file
            .read_into(position, destination)
            .map_err(map_driver_error)
    }

    fn write(&mut self, position: Option<u64>, source: &[u8]) -> Result<usize, HostError> {
        let position = i64::try_from(position.unwrap_or(0))
            .map_err(|_| HostError::new(HostErrorCode::Bounds, "file position is too large"))?;
        self.file.write(position, source).map_err(map_driver_error)
    }

    fn release(&mut self) -> Result<(), HostError> {
        self.file.release().map_err(map_driver_error)
    }
}

struct MemoryBinding {
    memory: BoundedMemory,
}

impl ResourceBinding for MemoryBinding {
    fn kind(&self) -> ResourceKind {
        ResourceKind::Memory
    }

    fn read(&mut self, position: Option<u64>, destination: &mut [u8]) -> Result<usize, HostError> {
        let position = usize::try_from(position.unwrap_or(0))
            .map_err(|_| HostError::new(HostErrorCode::Bounds, "memory position is too large"))?;
        self.memory
            .read_into(position, destination)
            .map_err(map_memory_error)
    }

    fn write(&mut self, position: Option<u64>, source: &[u8]) -> Result<usize, HostError> {
        let position = usize::try_from(position.unwrap_or(0))
            .map_err(|_| HostError::new(HostErrorCode::Bounds, "memory position is too large"))?;
        self.memory
            .write(position, source)
            .map(|()| source.len())
            .map_err(map_memory_error)
    }

    fn release(&mut self) -> Result<(), HostError> {
        self.memory.release().map_err(map_memory_error)
    }
}

fn map_driver_error(code: i32) -> HostError {
    let class = match code {
        -1 => HostErrorCode::UnknownResource,
        -2 => HostErrorCode::PermissionDenied,
        -3 | -4 => HostErrorCode::ResourceLimit,
        -5 => HostErrorCode::Bounds,
        -7 => HostErrorCode::Unsupported,
        _ => HostErrorCode::External,
    };
    HostError::new(class, format!("file resource error {code}"))
}

fn map_memory_error(error: MemoryError) -> HostError {
    let class = match error {
        MemoryError::Retired => HostErrorCode::UnknownResource,
        MemoryError::Bounds => HostErrorCode::Bounds,
        MemoryError::Capacity => HostErrorCode::ResourceLimit,
    };
    HostError::new(class, format!("memory resource error: {error:?}"))
}

struct PendingResource {
    binding: Box<dyn ResourceBinding>,
}

pub struct WasmcHostBuilder {
    runtime_config: CoreRuntimeSdkConfig,
    pending: BTreeMap<String, PendingResource>,
    report: BindingReport,
}

impl Default for WasmcHostBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl WasmcHostBuilder {
    pub fn new() -> Self {
        Self {
            runtime_config: CoreRuntimeSdkConfig::default(),
            pending: BTreeMap::new(),
            report: BindingReport::new(),
        }
    }

    pub fn runtime_config(mut self, config: CoreRuntimeSdkConfig) -> Self {
        self.runtime_config = config;
        self
    }

    pub fn grant_resource(
        mut self,
        selector: impl Into<String>,
        binding: Box<dyn ResourceBinding>,
    ) -> Result<Self, HostError> {
        self.insert_resource(selector.into(), binding, BindingOrigin::Explicit)?;
        Ok(self)
    }

    pub fn grant_memory(
        mut self,
        selector: impl Into<String>,
        capacity: usize,
    ) -> Result<Self, HostError> {
        let memory = BoundedMemory::new(capacity).map_err(map_memory_error)?;
        self.insert_resource(
            selector.into(),
            Box::new(MemoryBinding { memory }),
            BindingOrigin::Explicit,
        )?;
        Ok(self)
    }

    pub fn grant_preopened_file(
        mut self,
        selector: impl Into<String>,
        file: File,
        writable: bool,
        max_io_bytes: usize,
        max_extent_bytes: usize,
    ) -> Result<Self, HostError> {
        let file = PreopenedFile::with_limits(file, writable, max_io_bytes, max_extent_bytes)
            .map_err(map_driver_error)?;
        self.insert_resource(
            selector.into(),
            Box::new(FileBinding { file }),
            BindingOrigin::Explicit,
        )?;
        Ok(self)
    }

    pub fn grant_file_path(
        self,
        selector: impl Into<String>,
        path: impl AsRef<Path>,
        writable: bool,
        max_io_bytes: usize,
        max_extent_bytes: usize,
    ) -> Result<Self, HostError> {
        let mut options = OpenOptions::new();
        options.read(true).write(writable);
        let file = options.open(path.as_ref()).map_err(|error| {
            HostError::new(
                HostErrorCode::External,
                format!("failed to open {}: {error}", path.as_ref().display()),
            )
        })?;
        self.grant_preopened_file(selector, file, writable, max_io_bytes, max_extent_bytes)
    }

    pub fn bind_native(self, policy: HostBindPolicy) -> Result<Self, HostError> {
        self.bind_native_with_mode(policy, BindMode::BestEffort)
    }

    pub fn bind_native_with_mode(
        mut self,
        policy: HostBindPolicy,
        mode: BindMode,
    ) -> Result<Self, HostError> {
        self.report.platform = HostPlatform::current();
        self.report.policy = policy;
        if policy == HostBindPolicy::Minimal {
            return Ok(self);
        }

        self = self.auto_memory(SAFE_SCRATCH_SELECTOR, SAFE_SCRATCH_BYTES, mode)?;

        if policy == HostBindPolicy::Development {
            match HostPlatform::current() {
                HostPlatform::Linux => {
                    for (selector, path) in [
                        ("os.proc.stat", "/proc/stat"),
                        ("os.proc.meminfo", "/proc/meminfo"),
                        ("os.proc.netdev", "/proc/net/dev"),
                        ("os.proc.loadavg", "/proc/loadavg"),
                    ] {
                        self = self.auto_readonly_file(selector, path, mode)?;
                    }
                }
                HostPlatform::Macos => self.report.notes.push(
                    "Development profile: no ambient macOS system resource is auto-granted in this release; add explicit generic grants."
                        .to_string(),
                ),
                HostPlatform::Windows => self.report.notes.push(
                    "Development profile: no ambient Windows system resource is auto-granted in this release; add explicit generic grants."
                        .to_string(),
                ),
                HostPlatform::Other => self.report.notes.push(
                    "Development profile: current platform has no automatic external resource grants."
                        .to_string(),
                ),
            }
        }
        Ok(self)
    }

    pub fn build(self) -> Result<WasmcHost, HostError> {
        let runtime = CoreRuntimeSdk::new(self.runtime_config).map_err(|error| {
            HostError::new(
                HostErrorCode::Runtime,
                format!("Core Runtime SDK initialization failed: {error}"),
            )
        })?;

        let mut selectors = BTreeMap::new();
        let mut handles = BTreeMap::new();
        let mut resources = BTreeMap::new();
        for (index, (selector, pending)) in self.pending.into_iter().enumerate() {
            let raw = u32::try_from(index + 1)
                .map_err(|_| HostError::new(HostErrorCode::ResourceLimit, "resource table full"))?;
            let handle = ResourceHandle(raw);
            selectors.insert(selector.clone(), handle);
            handles.insert(handle, selector);
            resources.insert(handle, pending.binding);
        }
        Ok(WasmcHost {
            runtime,
            selectors,
            handles,
            resources,
            report: self.report,
        })
    }

    fn insert_resource(
        &mut self,
        selector: String,
        binding: Box<dyn ResourceBinding>,
        origin: BindingOrigin,
    ) -> Result<(), HostError> {
        validate_selector(&selector)?;
        if self.pending.contains_key(&selector) {
            return Err(HostError::new(
                HostErrorCode::DuplicateSelector,
                format!("duplicate Host resource selector {selector:?}"),
            ));
        }
        let kind = binding.kind();
        self.pending
            .insert(selector.clone(), PendingResource { binding });
        self.report.bound.push(BindingRecord {
            selector,
            kind,
            origin,
        });
        Ok(())
    }

    fn auto_memory(
        mut self,
        selector: &str,
        capacity: usize,
        mode: BindMode,
    ) -> Result<Self, HostError> {
        match BoundedMemory::new(capacity) {
            Ok(memory) => {
                self.insert_resource(
                    selector.to_string(),
                    Box::new(MemoryBinding { memory }),
                    BindingOrigin::Automatic,
                )?;
                Ok(self)
            }
            Err(error) => self.auto_failure(selector, format!("{error:?}"), mode),
        }
    }

    fn auto_readonly_file(
        mut self,
        selector: &str,
        path: &str,
        mode: BindMode,
    ) -> Result<Self, HostError> {
        match File::open(path) {
            Ok(file) => match PreopenedFile::with_limits(
                file,
                false,
                DEVELOPMENT_FILE_MAX_BYTES,
                DEVELOPMENT_FILE_MAX_BYTES,
            ) {
                Ok(file) => {
                    self.insert_resource(
                        selector.to_string(),
                        Box::new(FileBinding { file }),
                        BindingOrigin::Automatic,
                    )?;
                    Ok(self)
                }
                Err(error) => self.auto_failure(selector, format!("driver error {error}"), mode),
            },
            Err(error) => self.auto_failure(selector, error.to_string(), mode),
        }
    }

    fn auto_failure(
        mut self,
        selector: &str,
        reason: String,
        mode: BindMode,
    ) -> Result<Self, HostError> {
        if mode == BindMode::Strict {
            Err(HostError::new(
                HostErrorCode::AutoBind,
                format!("failed to auto-bind {selector:?}: {reason}"),
            ))
        } else {
            self.report.skipped.push(BindingSkip {
                selector: selector.to_string(),
                reason,
            });
            Ok(self)
        }
    }
}

fn validate_selector(selector: &str) -> Result<(), HostError> {
    if selector.is_empty()
        || selector.len() > 255
        || selector
            .bytes()
            .any(|byte| byte == 0 || byte.is_ascii_control())
    {
        Err(HostError::new(
            HostErrorCode::InvalidSelector,
            "resource selector must be 1..=255 non-control bytes",
        ))
    } else {
        Ok(())
    }
}

pub struct WasmcHost {
    runtime: CoreRuntimeSdk,
    selectors: BTreeMap<String, ResourceHandle>,
    handles: BTreeMap<ResourceHandle, String>,
    resources: BTreeMap<ResourceHandle, Box<dyn ResourceBinding>>,
    report: BindingReport,
}

impl WasmcHost {
    pub fn builder() -> WasmcHostBuilder {
        WasmcHostBuilder::new()
    }

    pub fn native(policy: HostBindPolicy) -> Result<Self, HostError> {
        WasmcHostBuilder::new().bind_native(policy)?.build()
    }

    pub fn native_strict(policy: HostBindPolicy) -> Result<Self, HostError> {
        WasmcHostBuilder::new()
            .bind_native_with_mode(policy, BindMode::Strict)?
            .build()
    }

    pub fn runtime(&self) -> &CoreRuntimeSdk {
        &self.runtime
    }

    pub fn binding_report(&self) -> &BindingReport {
        &self.report
    }

    pub fn selectors(&self) -> impl Iterator<Item = &str> {
        self.selectors.keys().map(String::as_str)
    }

    pub fn open(&self, selector: &str) -> Result<ResourceHandle, HostError> {
        self.selectors.get(selector).copied().ok_or_else(|| {
            HostError::new(
                HostErrorCode::UnknownResource,
                format!("unknown Host resource selector {selector:?}"),
            )
        })
    }

    pub fn read(
        &mut self,
        handle: ResourceHandle,
        position: Option<u64>,
        destination: &mut [u8],
    ) -> Result<usize, HostError> {
        self.resource_mut(handle)?.read(position, destination)
    }

    pub fn write(
        &mut self,
        handle: ResourceHandle,
        position: Option<u64>,
        source: &[u8],
    ) -> Result<usize, HostError> {
        self.resource_mut(handle)?.write(position, source)
    }

    pub fn invoke(
        &mut self,
        handle: ResourceHandle,
        opcode: u32,
        request: &[u8],
        response: &mut [u8],
    ) -> Result<usize, HostError> {
        self.resource_mut(handle)?.invoke(opcode, request, response)
    }

    pub fn release(&mut self, handle: ResourceHandle) -> Result<(), HostError> {
        self.resource_mut(handle)?.release()?;
        self.resources.remove(&handle);
        if let Some(selector) = self.handles.remove(&handle) {
            self.selectors.remove(&selector);
        }
        Ok(())
    }

    fn resource_mut(
        &mut self,
        handle: ResourceHandle,
    ) -> Result<&mut (dyn ResourceBinding + '_), HostError> {
        match self.resources.get_mut(&handle) {
            Some(resource) => Ok(resource.as_mut()),
            None => Err(HostError::new(
                HostErrorCode::UnknownResource,
                format!("unknown Host resource handle {}", handle.raw()),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::Write,
        sync::atomic::{AtomicU64, Ordering},
    };

    static NEXT_TEMP: AtomicU64 = AtomicU64::new(1);

    fn temporary_file(contents: &[u8]) -> (std::path::PathBuf, File) {
        let path = std::env::temp_dir().join(format!(
            "wasmc-host-sdk-{}-{}",
            std::process::id(),
            NEXT_TEMP.fetch_add(1, Ordering::Relaxed)
        ));
        let mut file = OpenOptions::new()
            .create_new(true)
            .read(true)
            .write(true)
            .open(&path)
            .unwrap();
        file.write_all(contents).unwrap();
        (path, file)
    }

    #[test]
    fn minimal_profile_grants_no_resources() {
        let host = WasmcHost::native(HostBindPolicy::Minimal).unwrap();
        assert_eq!(host.binding_report().policy(), HostBindPolicy::Minimal);
        assert_eq!(host.selectors().count(), 0);
    }

    #[test]
    fn safe_profile_grants_only_scratch_memory() {
        let mut host = WasmcHost::native(HostBindPolicy::Safe).unwrap();
        let selectors = host.selectors().collect::<Vec<_>>();
        assert_eq!(selectors, [SAFE_SCRATCH_SELECTOR]);
        let handle = host.open(SAFE_SCRATCH_SELECTOR).unwrap();
        assert_eq!(host.write(handle, Some(7), b"wasmc").unwrap(), 5);
        let mut bytes = [0_u8; 5];
        assert_eq!(host.read(handle, Some(7), &mut bytes).unwrap(), 5);
        assert_eq!(&bytes, b"wasmc");
    }

    #[test]
    fn explicit_file_grant_is_generic_and_bounded() {
        let (path, file) = temporary_file(b"hello host");
        let mut host = WasmcHost::builder()
            .grant_preopened_file("input", file, false, 4096, 4096)
            .unwrap()
            .build()
            .unwrap();
        let handle = host.open("input").unwrap();
        let mut bytes = [0_u8; 10];
        assert_eq!(host.read(handle, Some(0), &mut bytes).unwrap(), 10);
        assert_eq!(&bytes, b"hello host");
        assert_eq!(
            host.write(handle, Some(0), b"x").unwrap_err().code(),
            HostErrorCode::PermissionDenied
        );
        host.release(handle).unwrap();
        assert_eq!(
            host.open("input").unwrap_err().code(),
            HostErrorCode::UnknownResource
        );
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn duplicate_selector_fails_closed() {
        let builder = WasmcHost::builder().grant_memory("same", 64).unwrap();
        let error = match builder.grant_memory("same", 64) {
            Ok(_) => panic!("duplicate selector was accepted"),
            Err(error) => error,
        };
        assert_eq!(error.code(), HostErrorCode::DuplicateSelector);
    }

    #[test]
    fn development_profile_is_platform_auditable() {
        let mut host = WasmcHost::native(HostBindPolicy::Development).unwrap();
        assert_eq!(host.binding_report().platform(), HostPlatform::current());
        assert!(host.open(SAFE_SCRATCH_SELECTOR).is_ok());
        if HostPlatform::current() == HostPlatform::Linux {
            for selector in [
                "os.proc.stat",
                "os.proc.meminfo",
                "os.proc.netdev",
                "os.proc.loadavg",
            ] {
                let handle = host.open(selector).unwrap();
                let mut bytes = [0_u8; 64];
                assert!(host.read(handle, Some(0), &mut bytes).unwrap() > 0);
            }
        } else {
            assert!(!host.binding_report().notes().is_empty());
        }
    }
}
