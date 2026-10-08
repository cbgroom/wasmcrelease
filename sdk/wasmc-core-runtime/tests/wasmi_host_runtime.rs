#![cfg(feature = "wasmi-runtime")]

use std::{
    sync::{mpsc, Arc, Condvar, Mutex},
    thread,
};

use wasmc_core_runtime::{
    CoreRuntimeLimitProfile, CoreScalarHostErrorCode, CoreScalarValue, I32HostBinding,
    I32HostImport, I32HostImportErrorCode, I32LaneHostError, I32LaneHostErrorCode,
    I32LaneHostImport, I32LaneHostSession, WasmiHostRuntime,
};

fn profile(max_concurrent_stores: usize) -> CoreRuntimeLimitProfile {
    CoreRuntimeLimitProfile::wasmi_bounded(
        100_000,
        100_000_000,
        1_000,
        65_536,
        32,
        max_concurrent_stores,
    )
}

fn finite_observation_profile() -> CoreRuntimeLimitProfile {
    // These finite workloads prove resumable accounting, not machine speed.
    // Keep the same fuel quantum and quotas, with a bounded scheduling margin;
    // the separate infinite-loop test retains its strict 1 ms deadline.
    CoreRuntimeLimitProfile::wasmi_bounded(100_000, 5_000_000_000, 1_000, 65_536, 32, 1)
        .with_observational_fuel()
}

#[test]
fn observational_fuel_runs_past_quota_and_measures_each_call() {
    let wasm = wat::parse_str(
        r#"(module
      (func (export "run") (param $n i32) (result i32)
        (local $i i32)
        (block $done (loop $again
          local.get $i local.get $n i32.ge_u br_if $done
          local.get $i i32.const 1 i32.add local.set $i br $again))
        local.get $i))"#,
    )
    .unwrap();
    let runtime = WasmiHostRuntime::new(finite_observation_profile()).unwrap();
    let artifact = runtime.prepare_i32_lib(&wasm).unwrap();
    let (result, fuel) =
        wasmc_core_runtime::measure_wasmi_fuel(|| artifact.invoke_i32(&[], "run", 100_000));
    assert_eq!(result.unwrap(), 100_000);
    assert!(fuel > 100_000, "actual consumption: {fuel}");
    let (result, repeated) =
        wasmc_core_runtime::measure_wasmi_fuel(|| artifact.invoke_i32(&[], "run", 100_000));
    assert_eq!(result.unwrap(), 100_000);
    assert_eq!(fuel, repeated);
    let bounded = WasmiHostRuntime::new(profile(1))
        .unwrap()
        .prepare_i32_lib(&wasm)
        .unwrap();
    assert_eq!(
        bounded.invoke_i32(&[], "run", 100_000).unwrap_err().code(),
        I32HostImportErrorCode::ResourceLimit
    );
}

#[test]
fn observational_fuel_preserves_deadlines_and_counts_failed_calls() {
    let wasm = wat::parse_str(
        r#"(module (func (export "run") (param i32) (result i32)
      (loop $again br $again) i32.const 0))"#,
    )
    .unwrap();
    let runtime = WasmiHostRuntime::new(
        CoreRuntimeLimitProfile::wasmi_bounded(100, 1_000_000, 10, 65_536, 32, 1)
            .with_observational_fuel(),
    )
    .unwrap();
    let artifact = runtime.prepare_i32_lib(&wasm).unwrap();
    let (result, fuel) =
        wasmc_core_runtime::measure_wasmi_fuel(|| artifact.invoke_i32(&[], "run", 0));
    assert!(result.unwrap_err().message().contains("wall-clock"));
    assert!(fuel > 100);
}

#[test]
fn observational_initialization_crosses_quota_without_replaying_effects() {
    use std::sync::atomic::{AtomicUsize, Ordering};
    let wasm = wat::parse_str(
        r#"(module
      (import "test" "effect" (func $effect (param i32) (result i32)))
      (global $ready (mut i32) (i32.const 0))
      (func $initialize (local $i i32)
        i32.const 1 call $effect drop
        (loop $again
          local.get $i i32.const 1 i32.add local.tee $i
          i32.const 100000 i32.lt_u br_if $again)
        i32.const 7 global.set $ready)
      (start $initialize)
      (func (export "run") (param i32) (result i32) global.get $ready)
      (func (export "__wasmc_sdk_start_0") (result i32) i32.const 42))"#,
    )
    .unwrap();
    let runtime = WasmiHostRuntime::new(finite_observation_profile()).unwrap();
    let import = I32HostImport::new("test", "effect");
    let artifact = runtime
        .prepare_i32_host(&wasm, std::slice::from_ref(&import))
        .unwrap();
    let effects = Arc::new(AtomicUsize::new(0));
    let counter = effects.clone();
    let bindings = [I32HostBinding::new(import, move |value| {
        counter.fetch_add(1, Ordering::SeqCst);
        value
    })];
    let (result, fuel) =
        wasmc_core_runtime::measure_wasmi_fuel(|| artifact.invoke_i32(&bindings, "run", 0));
    assert_eq!(result.unwrap(), 7);
    assert!(fuel > 100_000);
    assert_eq!(effects.load(Ordering::SeqCst), 1);
}

#[test]
fn observation_scope_nests_and_restores_after_unwind() {
    let runtime = WasmiHostRuntime::new(profile(1).with_observational_fuel()).unwrap();
    let artifact = runtime.prepare_i32_lib(&scalar_lib_module()).unwrap();
    let ((_, inner), outer) = wasmc_core_runtime::measure_wasmi_fuel(|| {
        wasmc_core_runtime::measure_wasmi_fuel(|| artifact.invoke_i32s(&[], "zero", &[]))
    });
    assert!(inner > 0);
    assert_eq!(inner, outer);
    let _ = std::panic::catch_unwind(|| wasmc_core_runtime::measure_wasmi_fuel(|| panic!("test")));
    let (_, restored) =
        wasmc_core_runtime::measure_wasmi_fuel(|| artifact.invoke_i32s(&[], "zero", &[]));
    assert_eq!(restored, inner);
}

fn imported_module() -> Vec<u8> {
    wat::parse_str(
        r#"(module
            (import "agentweb" "capability_level" (func $capability_level (param i32) (result i32)))
            (func (export "run") (param i32) (result i32)
                local.get 0
                call $capability_level))"#,
    )
    .unwrap()
}

fn scalar_lib_module() -> Vec<u8> {
    wat::parse_str(
        r#"(module
            (func (export "zero") (result i32) i32.const 9)
            (func (export "three") (param i32 i32 i32) (result i32)
                local.get 0 local.get 1 i32.add local.get 2 i32.add)
            (func (export "eight")
                (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
                local.get 0 local.get 1 i32.add local.get 2 i32.add
                local.get 3 i32.add local.get 4 i32.add local.get 5 i32.add
                local.get 6 i32.add local.get 7 i32.add)
            (func (export "wrong-result") (param i32) (result i64)
                local.get 0 i64.extend_i32_s))"#,
    )
    .unwrap()
}

fn typed_scalar_lib_module() -> Vec<u8> {
    wat::parse_str(
        r#"(module
            (func (export "merge-count") (param i64 i64) (result i64)
                local.get 0 local.get 1 i64.add)
            (func (export "merge-mean") (param f64 f64 f64 f64) (result f64)
                local.get 0 local.get 1 f64.mul
                local.get 2 local.get 3 f64.mul f64.add
                local.get 1 local.get 3 f64.add f64.div)
            (func (export "roundtrip") (param i32 i64 f32 f64)
                (result i32 i64 f32 f64)
                local.get 0 local.get 1 local.get 2 local.get 3))"#,
    )
    .unwrap()
}

fn resource_host_module() -> Vec<u8> {
    wat::parse_str(
        r#"(module
            (import "wasmc:host" "open" (func $open (param i32 i32) (result i32)))
            (import "wasmc:host" "read" (func $read (param i32 i32 i32 i32) (result i32)))
            (import "wasmc:host" "write" (func $write (param i32 i32 i32) (result i32)))
            (import "wasmc:host" "invoke" (func $invoke
                (param i32 i32 i32 i32 i32 i32 i32) (result i32)))
            (import "wasmc:host" "release" (func $release (param i32) (result i32)))
            (memory (export "memory") 1)
            (data (i32.const 0) "node")
            (data (i32.const 16) "ping")
            (data (i32.const 24) "abc")
            (func (export "run") (result i32)
                (local $handle i32)
                i32.const 0 i32.const 4 call $open local.set $handle
                local.get $handle i32.const 0 i32.const 32 i32.const 8 call $read drop
                local.get $handle i32.const 24 i32.const 3 call $write drop
                local.get $handle
                i32.const 16 i32.const 4
                i32.const 24 i32.const 3
                i32.const 48 i32.const 8
                call $invoke drop
                local.get $handle call $release drop
                i32.const 32 i32.load8_u))"#,
    )
    .unwrap()
}

fn resource_imports() -> Vec<I32LaneHostImport> {
    [
        ("open", 2),
        ("read", 4),
        ("write", 3),
        ("invoke", 7),
        ("release", 1),
    ]
    .into_iter()
    .map(|(name, arity)| I32LaneHostImport::new("wasmc:host", name, arity))
    .collect()
}

#[derive(Debug, Default, Eq, PartialEq)]
struct ResourceState {
    calls: Vec<String>,
    written: Vec<u8>,
    released: bool,
}

fn resource_session(imports: &[I32LaneHostImport]) -> I32LaneHostSession<ResourceState> {
    I32LaneHostSession::new(ResourceState::default())
        .bind(imports[0].clone(), |state, memory, arguments| {
            let mut selector = vec![0; arguments[1] as usize];
            memory.read(arguments[0] as u32, &mut selector)?;
            state
                .calls
                .push(format!("open:{}", String::from_utf8_lossy(&selector)));
            Ok(7)
        })
        .bind(imports[1].clone(), |state, memory, arguments| {
            state.calls.push(format!("read:{}", arguments[0]));
            memory.write(arguments[2] as u32, b"metrics")?;
            Ok(7)
        })
        .bind(imports[2].clone(), |state, memory, arguments| {
            let mut bytes = vec![0; arguments[2] as usize];
            memory.read(arguments[1] as u32, &mut bytes)?;
            state.calls.push(format!("write:{}", arguments[0]));
            state.written = bytes;
            Ok(arguments[2])
        })
        .bind(imports[3].clone(), |state, memory, arguments| {
            let mut operation = vec![0; arguments[2] as usize];
            memory.read(arguments[1] as u32, &mut operation)?;
            state.calls.push(format!(
                "invoke:{}:{}",
                arguments[0],
                String::from_utf8_lossy(&operation)
            ));
            memory.write(arguments[5] as u32, b"analysis")?;
            Ok(8)
        })
        .bind(imports[4].clone(), |state, _memory, arguments| {
            state.calls.push(format!("release:{}", arguments[0]));
            state.released = true;
            Ok(0)
        })
}

#[test]
fn invokes_memory_backed_resource_host_lane_without_wasmtime() {
    let runtime = WasmiHostRuntime::new(profile(2)).unwrap();
    let imports = resource_imports();
    let wasm = resource_host_module();
    let artifact = runtime.prepare_i32_lane_host(&wasm, &imports).unwrap();

    assert_eq!(artifact.wasm_bytes(), wasm.len());
    assert_eq!(artifact.imports(), imports);
    let outcome = artifact.invoke_i32_lane_with_session(resource_session(&imports), "run", &[]);
    assert_eq!(outcome.result.unwrap(), i32::from(b'm'));
    assert_eq!(outcome.state.written, b"abc");
    assert!(outcome.state.released);
    assert_eq!(
        outcome.state.calls,
        [
            "open:node",
            "read:7",
            "write:7",
            "invoke:7:ping",
            "release:7"
        ]
    );
}

#[test]
fn invokes_import_free_typed_scalar_lib_without_wasmtime() {
    let runtime = WasmiHostRuntime::new(profile(2)).unwrap();
    let wasm = typed_scalar_lib_module();
    let artifact = runtime.prepare_scalar_lib(&wasm).unwrap();

    assert_eq!(artifact.wasm_bytes(), wasm.len());
    assert_eq!(
        artifact
            .invoke(
                "merge-count",
                &[CoreScalarValue::I64(40), CoreScalarValue::I64(2)],
            )
            .unwrap(),
        [CoreScalarValue::I64(42)]
    );
    assert_eq!(
        artifact
            .invoke(
                "merge-mean",
                &[
                    CoreScalarValue::F64(10.0_f64.to_bits()),
                    CoreScalarValue::F64(2.0_f64.to_bits()),
                    CoreScalarValue::F64(20.0_f64.to_bits()),
                    CoreScalarValue::F64(2.0_f64.to_bits()),
                ],
            )
            .unwrap(),
        [CoreScalarValue::F64(15.0_f64.to_bits())]
    );
    let negative_zero = (-0.0_f64).to_bits();
    let nan = 0x7ff8_0000_0000_0042;
    assert_eq!(
        artifact
            .invoke(
                "roundtrip",
                &[
                    CoreScalarValue::I32(-7),
                    CoreScalarValue::I64(i64::MIN),
                    CoreScalarValue::F32(0x7fc0_0042),
                    CoreScalarValue::F64(negative_zero),
                ],
            )
            .unwrap(),
        [
            CoreScalarValue::I32(-7),
            CoreScalarValue::I64(i64::MIN),
            CoreScalarValue::F32(0x7fc0_0042),
            CoreScalarValue::F64(negative_zero),
        ]
    );
    assert_eq!(
        artifact
            .invoke(
                "roundtrip",
                &[
                    CoreScalarValue::I32(0),
                    CoreScalarValue::I64(0),
                    CoreScalarValue::F32(0),
                    CoreScalarValue::F64(nan),
                ]
            )
            .unwrap()[3],
        CoreScalarValue::F64(nan)
    );
}

#[test]
fn typed_scalar_lib_rejects_authority_and_shape_drift() {
    let runtime = WasmiHostRuntime::new(profile(1)).unwrap();
    let error = runtime
        .prepare_scalar_lib(&imported_module())
        .err()
        .unwrap();
    assert_eq!(error.code(), CoreScalarHostErrorCode::ImportMismatch);

    let artifact = runtime
        .prepare_scalar_lib(&typed_scalar_lib_module())
        .unwrap();
    for arguments in [
        vec![CoreScalarValue::I64(1)],
        vec![CoreScalarValue::I32(1), CoreScalarValue::I32(2)],
        vec![CoreScalarValue::I64(0); 17],
    ] {
        let error = artifact.invoke("merge-count", &arguments).unwrap_err();
        assert!(matches!(
            error.code(),
            CoreScalarHostErrorCode::InvalidPlan | CoreScalarHostErrorCode::Invocation
        ));
    }
}

#[test]
fn resource_host_lane_returns_state_after_callback_failure() {
    let runtime = WasmiHostRuntime::new(profile(1)).unwrap();
    let import = I32LaneHostImport::new("host", "fail", 0);
    let wasm = wat::parse_str(
        r#"(module
            (import "host" "fail" (func $fail (result i32)))
            (memory (export "memory") 1)
            (func (export "run") (result i32) call $fail))"#,
    )
    .unwrap();
    let artifact = runtime
        .prepare_i32_lane_host(&wasm, std::slice::from_ref(&import))
        .unwrap();
    let session =
        I32LaneHostSession::new(vec!["before"]).bind(import, |state, _memory, _arguments| {
            state.push("callback");
            Err(I32LaneHostError::callback("expected failure"))
        });

    let outcome = artifact.invoke_i32_lane_with_session(session, "run", &[]);
    assert_eq!(
        outcome.result.unwrap_err().code(),
        I32LaneHostErrorCode::Invocation
    );
    assert_eq!(outcome.state, ["before", "callback"]);
}

#[test]
fn invokes_exact_reviewed_i32_host_import_without_wasmtime() {
    let runtime = WasmiHostRuntime::new(profile(2)).unwrap();
    let import = I32HostImport::new("agentweb", "capability_level");
    let wasm = imported_module();
    let artifact = runtime
        .prepare_i32_host(&wasm, std::slice::from_ref(&import))
        .unwrap();

    assert_eq!(artifact.wasm_bytes(), wasm.len());
    assert_eq!(artifact.imports(), std::slice::from_ref(&import));
    assert_eq!(runtime.compile_count(), 1);
    assert_eq!(
        artifact
            .invoke_i32(
                &[I32HostBinding::new(import, |requested| requested.min(7))],
                "run",
                11,
            )
            .unwrap(),
        7
    );
}

#[test]
fn invokes_import_free_scalar_lib_exports_with_zero_to_eight_i32_parameters() {
    let runtime = WasmiHostRuntime::new(profile(2)).unwrap();
    let wasm = scalar_lib_module();
    let artifact = runtime.prepare_i32_lib(&wasm).unwrap();

    assert!(artifact.imports().is_empty());
    assert_eq!(artifact.invoke_i32s(&[], "zero", &[]).unwrap(), 9);
    assert_eq!(artifact.invoke_i32s(&[], "three", &[2, 3, 5]).unwrap(), 10);
    assert_eq!(
        artifact
            .invoke_i32s(&[], "eight", &[1, 2, 3, 4, 5, 6, 7, 8])
            .unwrap(),
        36
    );
}

#[test]
fn rejects_scalar_lib_export_arity_and_result_drift() {
    let runtime = WasmiHostRuntime::new(profile(1)).unwrap();
    let wasm = scalar_lib_module();
    let artifact = runtime.prepare_i32_lib(&wasm).unwrap();

    for (export, arguments) in [
        ("three", vec![1, 2]),
        ("wrong-result", vec![1]),
        ("eight", vec![0; 9]),
    ] {
        let error = artifact.invoke_i32s(&[], export, &arguments).unwrap_err();
        assert_eq!(error.code(), I32HostImportErrorCode::Invocation);
    }
}

#[test]
fn rejects_unbounded_runtime_and_import_plan_drift() {
    let error = WasmiHostRuntime::new(CoreRuntimeLimitProfile::unbounded())
        .err()
        .unwrap();
    assert_eq!(error.code(), I32HostImportErrorCode::InvalidPlan);

    let runtime = WasmiHostRuntime::new(profile(1)).unwrap();
    let error = runtime
        .prepare_i32_host(&scalar_lib_module(), &[])
        .err()
        .unwrap();
    assert_eq!(error.code(), I32HostImportErrorCode::InvalidPlan);

    let error = runtime.prepare_i32_lib(&imported_module()).err().unwrap();
    assert_eq!(error.code(), I32HostImportErrorCode::ImportMismatch);

    let error = runtime
        .prepare_i32_host(
            &imported_module(),
            &[I32HostImport::new("agentweb", "different")],
        )
        .err()
        .unwrap();
    assert_eq!(error.code(), I32HostImportErrorCode::ImportMismatch);
}

#[test]
fn classifies_guest_fuel_exhaustion_as_resource_limit() {
    let runtime = WasmiHostRuntime::new(CoreRuntimeLimitProfile::wasmi_bounded(
        100,
        100_000_000,
        10,
        65_536,
        32,
        1,
    ))
    .unwrap();
    let import = I32HostImport::new("agentweb", "capability_level");
    let wasm = wat::parse_str(
        r#"(module
            (import "agentweb" "capability_level" (func (param i32) (result i32)))
            (func (export "run") (param i32) (result i32)
                (loop $again br $again)
                i32.const 0))"#,
    )
    .unwrap();
    let artifact = runtime
        .prepare_i32_host(&wasm, std::slice::from_ref(&import))
        .unwrap();
    let error = artifact
        .invoke_i32(&[I32HostBinding::new(import, |value| value)], "run", 1)
        .unwrap_err();
    assert_eq!(error.code(), I32HostImportErrorCode::ResourceLimit);
}

#[test]
fn rejects_a_second_concurrent_store_before_callback_execution() {
    let runtime = WasmiHostRuntime::new(profile(1)).unwrap();
    let import = I32HostImport::new("agentweb", "capability_level");
    let artifact = Arc::new(
        runtime
            .prepare_i32_host(&imported_module(), std::slice::from_ref(&import))
            .unwrap(),
    );
    let release = Arc::new((Mutex::new(false), Condvar::new()));
    let (started_tx, started_rx) = mpsc::channel();
    let first_artifact = Arc::clone(&artifact);
    let first_import = import.clone();
    let first_release = Arc::clone(&release);
    let first = thread::spawn(move || {
        first_artifact.invoke_i32(
            &[I32HostBinding::new(first_import, move |value| {
                started_tx.send(()).unwrap();
                let (lock, wake) = &*first_release;
                let mut released = lock.lock().unwrap();
                while !*released {
                    released = wake.wait(released).unwrap();
                }
                value
            })],
            "run",
            3,
        )
    });

    started_rx.recv().unwrap();
    let error = artifact
        .invoke_i32(&[I32HostBinding::new(import, |value| value)], "run", 4)
        .unwrap_err();
    assert_eq!(error.code(), I32HostImportErrorCode::ResourceLimit);

    let (lock, wake) = &*release;
    *lock.lock().unwrap() = true;
    wake.notify_one();
    assert_eq!(first.join().unwrap().unwrap(), 3);
}
