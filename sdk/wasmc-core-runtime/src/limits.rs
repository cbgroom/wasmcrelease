//! Exact Host-owned limits for one Core runtime SDK instance.

#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
use std::sync::atomic::AtomicUsize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
#[cfg(feature = "wasmi-runtime")]
use std::time::{Duration, Instant};

#[cfg(feature = "wasmi-runtime")]
use wasmi::{Func, ResumableCall, Store, Val};

#[cfg(feature = "wasmtime-runtime")]
pub(crate) const EPOCH_TICK_NS: u64 = 1_000_000;

/// Host-owned cooperative cancellation signal for one or more invocations.
///
/// Clones observe the same signal. A token is monotonic: once cancelled it
/// remains cancelled, so Hosts should create a fresh token for unrelated work.
#[derive(Clone, Debug, Default)]
pub struct CoreRuntimeCancellation {
    cancelled: Arc<AtomicBool>,
}

impl CoreRuntimeCancellation {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Release);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Acquire)
    }
}

/// One complete bounded policy shared by Wasmi completion and Wasmtime reuse.
///
/// Fuel units are engine-specific and therefore explicit for each engine.
/// All other fields describe common observable bounds. Use [`Self::bounded`]
/// instead of constructing a partial policy.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub struct CoreRuntimeLimitProfile {
    wasmi_fuel: u64,
    wasmtime_fuel: u64,
    wall_clock_ns: u64,
    wasmi_fuel_quantum: u64,
    max_memory_bytes: usize,
    max_table_elements: usize,
    max_concurrent_stores: usize,
    bounded: bool,
}

impl CoreRuntimeLimitProfile {
    /// Preserve the historical unlimited embedding behavior explicitly.
    pub const fn unbounded() -> Self {
        Self {
            wasmi_fuel: 0,
            wasmtime_fuel: 0,
            wall_clock_ns: 0,
            wasmi_fuel_quantum: 0,
            max_memory_bytes: 0,
            max_table_elements: 0,
            max_concurrent_stores: 0,
            bounded: false,
        }
    }

    /// Construct one complete bounded profile.
    pub const fn bounded(
        wasmi_fuel: u64,
        wasmtime_fuel: u64,
        wall_clock_ns: u64,
        wasmi_fuel_quantum: u64,
        max_memory_bytes: usize,
        max_table_elements: usize,
        max_concurrent_stores: usize,
    ) -> Self {
        Self {
            wasmi_fuel,
            wasmtime_fuel,
            wall_clock_ns,
            wasmi_fuel_quantum,
            max_memory_bytes,
            max_table_elements,
            max_concurrent_stores,
            bounded: true,
        }
    }

    pub const fn is_bounded(self) -> bool {
        self.bounded
    }

    pub const fn wasmi_fuel(self) -> u64 {
        self.wasmi_fuel
    }

    pub const fn wasmtime_fuel(self) -> u64 {
        self.wasmtime_fuel
    }

    pub const fn wall_clock_ns(self) -> u64 {
        self.wall_clock_ns
    }

    pub const fn wasmi_fuel_quantum(self) -> u64 {
        self.wasmi_fuel_quantum
    }

    pub const fn max_memory_bytes(self) -> usize {
        self.max_memory_bytes
    }

    pub const fn max_table_elements(self) -> usize {
        self.max_table_elements
    }

    pub const fn max_concurrent_stores(self) -> usize {
        self.max_concurrent_stores
    }

    #[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
    pub(crate) fn validate(self) -> Result<(), &'static str> {
        if !self.bounded {
            return Ok(());
        }
        if self.wasmi_fuel == 0
            || self.wasmtime_fuel == 0
            || self.wall_clock_ns == 0
            || self.wasmi_fuel_quantum == 0
            || self.max_memory_bytes == 0
            || self.max_table_elements == 0
            || self.max_concurrent_stores == 0
        {
            return Err("every bounded Core runtime limit must be positive");
        }
        if self.wasmi_fuel_quantum > self.wasmi_fuel {
            return Err("Wasmi fuel quantum cannot exceed the invocation fuel budget");
        }
        if self.wall_clock_ns < EPOCH_TICK_NS {
            return Err("Core wall-clock limit must be at least 1 millisecond");
        }
        Ok(())
    }

    #[cfg(feature = "wasmtime-runtime")]
    pub(crate) const fn wasmtime_deadline_ticks(self) -> u64 {
        self.wall_clock_ns.div_ceil(EPOCH_TICK_NS)
    }
}

impl Default for CoreRuntimeLimitProfile {
    fn default() -> Self {
        Self::unbounded()
    }
}

#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
pub(crate) struct ConcurrentStoreAdmission {
    maximum: usize,
    active: AtomicUsize,
}

#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
impl ConcurrentStoreAdmission {
    pub(crate) const fn new(profile: CoreRuntimeLimitProfile) -> Self {
        Self {
            maximum: profile.max_concurrent_stores,
            active: AtomicUsize::new(0),
        }
    }

    pub(crate) fn try_acquire(&self) -> Option<ConcurrentStorePermit<'_>> {
        if self.maximum == 0 {
            return Some(ConcurrentStorePermit { admission: self });
        }
        let mut active = self.active.load(Ordering::Acquire);
        loop {
            if active >= self.maximum {
                return None;
            }
            match self.active.compare_exchange_weak(
                active,
                active + 1,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => return Some(ConcurrentStorePermit { admission: self }),
                Err(observed) => active = observed,
            }
        }
    }
}

#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
pub(crate) struct ConcurrentStorePermit<'a> {
    admission: &'a ConcurrentStoreAdmission,
}

#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
impl Drop for ConcurrentStorePermit<'_> {
    fn drop(&mut self) {
        if self.admission.maximum != 0 {
            self.admission.active.fetch_sub(1, Ordering::AcqRel);
        }
    }
}

#[cfg(feature = "wasmi-runtime")]
pub(crate) fn invoke_wasmi_bounded<T>(
    store: &mut Store<T>,
    function: &Func,
    inputs: &[Val],
    outputs: &mut [Val],
    profile: CoreRuntimeLimitProfile,
) -> Result<(), wasmi::Error> {
    invoke_wasmi_bounded_with_cancellation(store, function, inputs, outputs, profile, None)
}

#[cfg(feature = "wasmi-runtime")]
pub(crate) fn invoke_wasmi_bounded_with_cancellation<T>(
    store: &mut Store<T>,
    function: &Func,
    inputs: &[Val],
    outputs: &mut [Val],
    profile: CoreRuntimeLimitProfile,
    cancellation: Option<&CoreRuntimeCancellation>,
) -> Result<(), wasmi::Error> {
    if cancellation.is_some_and(CoreRuntimeCancellation::is_cancelled) {
        return Err(wasmi::Error::new("Core invocation cancelled"));
    }
    if !profile.is_bounded() {
        let result = function.call(store, inputs, outputs);
        if cancellation.is_some_and(CoreRuntimeCancellation::is_cancelled) {
            return Err(wasmi::Error::new("Core invocation cancelled"));
        }
        return result;
    }
    let deadline = Instant::now()
        .checked_add(Duration::from_nanos(profile.wall_clock_ns()))
        .ok_or_else(|| wasmi::Error::new("Core wall-clock deadline overflow"))?;
    let mut remaining = profile.wasmi_fuel();
    let mut supplied = remaining.min(profile.wasmi_fuel_quantum());
    store.set_fuel(supplied)?;
    let mut call = function.call_resumable(&mut *store, inputs, outputs)?;
    loop {
        match call {
            ResumableCall::Finished => {
                return if cancellation.is_some_and(CoreRuntimeCancellation::is_cancelled) {
                    Err(wasmi::Error::new("Core invocation cancelled"))
                } else if Instant::now() >= deadline {
                    Err(wasmi::Error::new("Core wall-clock limit exceeded"))
                } else {
                    Ok(())
                };
            }
            ResumableCall::HostTrap(trap) => return Err(trap.into_host_error()),
            ResumableCall::OutOfFuel(out_of_fuel) => {
                if cancellation.is_some_and(CoreRuntimeCancellation::is_cancelled) {
                    return Err(wasmi::Error::new("Core invocation cancelled"));
                }
                remaining = remaining.saturating_sub(supplied);
                if remaining == 0 {
                    return Err(wasmi::Error::new("Core fuel limit exhausted"));
                }
                if Instant::now() >= deadline {
                    return Err(wasmi::Error::new("Core wall-clock limit exceeded"));
                }
                supplied = remaining.min(
                    profile
                        .wasmi_fuel_quantum()
                        .max(out_of_fuel.required_fuel()),
                );
                store.set_fuel(supplied)?;
                call = out_of_fuel.resume(&mut *store, outputs)?;
            }
        }
    }
}

#[cfg(all(feature = "wasmi-runtime", feature = "wasmtime-runtime"))]
pub(crate) fn is_resource_limit_message(message: &str) -> bool {
    let message = message.to_ascii_lowercase();
    message.contains("fuel")
        || message.contains("growth operation limited")
        || message.contains("resource limit")
        || message.contains("memory growth")
        || message.contains("table growth")
        || message.contains("growing memory")
        || message.contains("growing table")
        || message.contains("interrupt")
        || message.contains("wall-clock limit")
}
