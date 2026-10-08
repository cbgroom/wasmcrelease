//! Exact Host-owned limits for one Core runtime SDK instance.

#[cfg(feature = "wasmi-runtime")]
use std::sync::atomic::AtomicUsize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
#[cfg(feature = "wasmi-runtime")]
use std::time::{Duration, Instant};

#[cfg(feature = "wasmi-runtime")]
use wasmi::{Func, ResumableCall, Store, Val};

#[cfg(feature = "wasmi-runtime")]
thread_local! {
    static OBSERVED_FUEL: std::cell::Cell<Option<u64>> = const { std::cell::Cell::new(None) };
}

/// Measure actual Wasmi fuel inside a synchronous execution scope.
///
/// Counts are engine-specific, saturate at u64::MAX, and include failed calls.
/// Scopes are thread-local, nest safely and restore state even when unwinding.
/// Resumable initialization is included for observational profiles. Run this scope inside the execution
/// worker, not around an async task which can migrate between threads.
#[cfg(feature = "wasmi-runtime")]
pub fn measure_wasmi_fuel<R>(operation: impl FnOnce() -> R) -> (R, u64) {
    struct Scope(Option<u64>);
    impl Drop for Scope {
        fn drop(&mut self) {
            OBSERVED_FUEL.with(|counter| {
                let consumed = counter.get().unwrap_or(0);
                counter.set(self.0.map(|outer| outer.saturating_add(consumed)));
            });
        }
    }
    let scope = Scope(OBSERVED_FUEL.with(|counter| counter.replace(Some(0))));
    let result = operation();
    let consumed = OBSERVED_FUEL.with(|counter| counter.get().unwrap_or(0));
    drop(scope);
    (result, consumed)
}

#[cfg(feature = "wasmi-runtime")]
fn record_wasmi_fuel<T>(store: &Store<T>, supplied: u64) {
    let consumed = supplied.saturating_sub(store.get_fuel().unwrap_or(supplied));
    OBSERVED_FUEL.with(|counter| {
        counter.set(counter.get().map(|total| total.saturating_add(consumed)));
    });
}

// Shared wall-clock policy unit: Wasmtime-only Hosts need it too. The limits
// module itself is already gated on the presence of either runtime engine.
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
    observational_fuel: bool,
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
            observational_fuel: false,
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
            observational_fuel: false,
        }
    }

    /// Construct a complete bounded Wasmi-only profile without assigning a
    /// synthetic Wasmtime fuel budget.
    pub const fn wasmi_bounded(
        wasmi_fuel: u64,
        wall_clock_ns: u64,
        wasmi_fuel_quantum: u64,
        max_memory_bytes: usize,
        max_table_elements: usize,
        max_concurrent_stores: usize,
    ) -> Self {
        Self {
            wasmi_fuel,
            wasmtime_fuel: 0,
            wall_clock_ns,
            wasmi_fuel_quantum,
            max_memory_bytes,
            max_table_elements,
            max_concurrent_stores,
            bounded: true,
            observational_fuel: false,
        }
    }

    pub const fn is_bounded(self) -> bool {
        self.bounded
    }

    /// Meter Wasmi calls and initialization without a total fuel quota.
    ///
    /// Replenishment preserves the suspended computation and Host effects.
    /// Memory, tables, store admission, wall-clock and cancellation remain
    /// governed by the profile. The SDK executes the original start function
    /// once through the same resumable path, before returning the instance.
    pub const fn with_observational_fuel(mut self) -> Self {
        self.observational_fuel = true;
        self
    }

    pub const fn observational_fuel(self) -> bool {
        self.observational_fuel
    }

    /// A Wasmi-only observation policy with no total fuel budget.
    /// The quantum is a replenishment/checkpoint interval, not a quota.
    pub const fn wasmi_observational(
        wall_clock_ns: u64,
        fuel_quantum: u64,
        max_memory_bytes: usize,
        max_table_elements: usize,
        max_concurrent_stores: usize,
    ) -> Self {
        Self::wasmi_bounded(
            fuel_quantum,
            wall_clock_ns,
            fuel_quantum,
            max_memory_bytes,
            max_table_elements,
            max_concurrent_stores,
        )
        .with_observational_fuel()
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
        self.validate_wasmi()?;
        if self.observational_fuel {
            return Err("observational fuel is supported by Wasmi-only runtime profiles");
        }
        if self.bounded && self.wasmtime_fuel == 0 {
            return Err("every bounded Core runtime limit must be positive");
        }
        Ok(())
    }

    #[cfg(feature = "wasmi-runtime")]
    pub(crate) fn validate_wasmi(self) -> Result<(), &'static str> {
        if !self.bounded {
            return Ok(());
        }
        if self.wasmi_fuel == 0
            || self.wall_clock_ns == 0
            || self.wasmi_fuel_quantum == 0
            || self.max_memory_bytes == 0
            || self.max_table_elements == 0
            || self.max_concurrent_stores == 0
        {
            return Err("every bounded Wasmi runtime limit must be positive");
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

#[cfg(all(test, feature = "wasmtime-runtime"))]
mod wasmtime_epoch_tests {
    use super::{CoreRuntimeLimitProfile, EPOCH_TICK_NS};
    use crate::WasmtimeSpeedRuntime;

    #[test]
    fn deadline_ticks_round_up_in_the_shared_clock_unit() {
        assert_eq!(EPOCH_TICK_NS, 1_000_000);
        for (ns, ticks) in [
            (0, 0),
            (1, 1),
            (999_999, 1),
            (1_000_000, 1),
            (1_000_001, 2),
            (u64::MAX, 18_446_744_073_710),
        ] {
            let limits = CoreRuntimeLimitProfile::bounded(1, 1, ns, 1, 65_536, 32, 1);
            assert_eq!(limits.wasmtime_deadline_ticks(), ticks);
        }
    }

    #[test]
    fn bounded_wasmtime_loop_interrupts_without_a_wasmi_engine() {
        let limits =
            CoreRuntimeLimitProfile::bounded(100_000, u64::MAX, 50_000_000, 1_000, 65_536, 32, 1);
        let runtime = WasmtimeSpeedRuntime::new_with_limits(limits).unwrap();
        let wasm = wat::parse_str(
            r#"(module
            (func (export "run") (param i32) (result i32)
                (loop (br 0)) i32.const 0))"#,
        )
        .unwrap();
        let module = runtime.compile_wasm(&wasm).unwrap();
        let error = module.invoke_i32("run", 0).unwrap_err();
        assert_eq!(
            error.downcast_ref::<wasmtime::Trap>(),
            Some(&wasmtime::Trap::Interrupt)
        );
        // A rejected invocation does not poison the runtime or its next fresh Store.
        let finite = wat::parse_str(
            r#"(module
            (func (export "run") (param i32) (result i32) local.get 0))"#,
        )
        .unwrap();
        assert_eq!(
            runtime
                .compile_wasm(&finite)
                .unwrap()
                .invoke_i32("run", 42)
                .unwrap(),
            42
        );
    }
}

#[cfg(feature = "wasmi-runtime")]
pub(crate) struct ConcurrentStoreAdmission {
    maximum: usize,
    active: AtomicUsize,
}

#[cfg(feature = "wasmi-runtime")]
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

#[cfg(feature = "wasmi-runtime")]
pub(crate) struct ConcurrentStorePermit<'a> {
    admission: &'a ConcurrentStoreAdmission,
}

#[cfg(feature = "wasmi-runtime")]
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
    let mut call = function
        .call_resumable(&mut *store, inputs, outputs)
        .inspect_err(|_| {
            record_wasmi_fuel(store, supplied);
        })?;
    loop {
        record_wasmi_fuel(store, supplied);
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
                if remaining == 0 && !profile.observational_fuel() {
                    return Err(wasmi::Error::new("Core fuel limit exhausted"));
                }
                if Instant::now() >= deadline {
                    return Err(wasmi::Error::new("Core wall-clock limit exceeded"));
                }
                let quantum = profile
                    .wasmi_fuel_quantum()
                    .max(out_of_fuel.required_fuel());
                supplied = if profile.observational_fuel() {
                    quantum
                } else {
                    remaining.min(quantum)
                };
                store.set_fuel(supplied)?;
                call = out_of_fuel.resume(&mut *store, outputs).inspect_err(|_| {
                    record_wasmi_fuel(store, supplied);
                })?;
            }
        }
    }
}

#[cfg(feature = "wasmi-runtime")]
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
