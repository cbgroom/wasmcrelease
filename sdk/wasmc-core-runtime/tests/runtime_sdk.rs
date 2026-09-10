use std::{
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};

use wasmc_core_runtime::{
    CoreModuleExternType, CoreModuleValueType, CoreRuntimeArtifactState, CoreRuntimeBackend,
    CoreRuntimeCancellation, CoreRuntimeInvocationErrorCode, CoreRuntimeLimitProfile,
    CoreRuntimeOptimizationDecision, CoreRuntimePolicyFingerprint, CoreRuntimeSdk,
    CoreRuntimeSdkConfig, CoreScalarHostImport, CoreScalarHostSession, CoreScalarType,
    CoreScalarValue, I32HostBinding, I32HostImport, I32LaneHostBinding, I32LaneHostImport,
    I32LaneHostSession,
};

#[test]
fn module_inspection_exposes_host_admission_facts_without_wasmtime() {
    let sdk = CoreRuntimeSdk::default();
    let wasm = wat::parse_str(
        r#"(module
          (import "host" "mix" (func $mix (param i32 i64 f32 f64) (result i64 f32)))
          (import "host" "flag" (global i32))
          (memory (export "memory") 1)
          (table (export "dispatch") 1 funcref)
          (global (export "answer") i32 (i32.const 42))
          (func (export "handle") (result i32) i32.const 200))"#,
    )
    .unwrap();

    let inspection = sdk.inspect_core(&wasm).unwrap();
    assert_eq!(inspection.wasm_bytes(), wasm.len());
    assert_eq!(inspection.imports().len(), 2);
    assert_eq!(inspection.imports()[0].module(), "host");
    assert_eq!(inspection.imports()[0].name(), "mix");
    assert_eq!(
        inspection.imports()[0].external_type(),
        &CoreModuleExternType::Function {
            params: vec![
                CoreModuleValueType::I32,
                CoreModuleValueType::I64,
                CoreModuleValueType::F32,
                CoreModuleValueType::F64,
            ],
            results: vec![CoreModuleValueType::I64, CoreModuleValueType::F32],
        }
    );
    assert_eq!(
        inspection.imports()[1].external_type(),
        &CoreModuleExternType::Global
    );
    for (name, expected) in [
        ("memory", CoreModuleExternType::Memory),
        ("dispatch", CoreModuleExternType::Table),
        ("answer", CoreModuleExternType::Global),
        (
            "handle",
            CoreModuleExternType::Function {
                params: Vec::new(),
                results: vec![CoreModuleValueType::I32],
            },
        ),
    ] {
        let export = inspection
            .exports()
            .iter()
            .find(|export| export.name() == name)
            .unwrap();
        assert_eq!(export.external_type(), &expected);
    }
    let status = sdk.status();
    assert_eq!(status.wasmi_inspection_count, 1);
    assert_eq!(status.wasmi_compile_count, 0);
    assert_eq!(status.wasmtime_compile_count, 0);
}

#[test]
fn module_inspection_rejects_invalid_core_before_business_admission() {
    let sdk = CoreRuntimeSdk::default();
    let error = sdk.inspect_core(b"not wasm").unwrap_err();
    assert!(error.to_string().contains("module inspection failed"));
    assert_eq!(sdk.status().wasmi_inspection_count, 0);
}

#[derive(Debug, Eq, PartialEq)]
struct RequestState {
    calls: usize,
    body: Vec<u8>,
}

fn policy(byte: u8) -> CoreRuntimePolicyFingerprint {
    CoreRuntimePolicyFingerprint::new([byte; 32])
}

#[test]
fn scalar_host_lane_preserves_the_wit_flat_set_on_both_engines() {
    let wasm = wat::parse_str(
        r#"(module
          (import "host" "mix" (func $mix
            (param i32 i64 f32 f64) (result i64 f32)))
          (memory (export "memory") 1)
          (func (export "run") (param i32 i64 f32 f64) (result i64 f32)
            local.get 0 local.get 1 local.get 2 local.get 3 call $mix))"#,
    )
    .unwrap();
    let import = CoreScalarHostImport::new(
        "host",
        "mix",
        vec![
            CoreScalarType::I32,
            CoreScalarType::I64,
            CoreScalarType::F32,
            CoreScalarType::F64,
        ],
        vec![CoreScalarType::I64, CoreScalarType::F32],
    );
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1)).unwrap();
    let artifact = sdk
        .prepare_scalar_host_core(&wasm, policy(18), std::slice::from_ref(&import))
        .unwrap();
    let session = || {
        CoreScalarHostSession::new(0_u8).bind(import.clone(), |state, memory, arguments| {
            assert_eq!(memory.byte_len()?, 65_536);
            memory.write(32, b"scalar")?;
            let mut roundtrip = [0_u8; 6];
            memory.read(32, &mut roundtrip)?;
            assert_eq!(&roundtrip, b"scalar");
            *state += 1;
            assert_eq!(
                arguments,
                &[
                    CoreScalarValue::I32(7),
                    CoreScalarValue::I64(41),
                    CoreScalarValue::F32(1.5_f32.to_bits()),
                    CoreScalarValue::F64((-2.25_f64).to_bits()),
                ]
            );
            Ok(vec![
                CoreScalarValue::I64(42),
                CoreScalarValue::F32(f32::NAN.to_bits()),
            ])
        })
    };
    let arguments = [
        CoreScalarValue::I32(7),
        CoreScalarValue::I64(41),
        CoreScalarValue::F32(1.5_f32.to_bits()),
        CoreScalarValue::F64((-2.25_f64).to_bits()),
    ];
    let completion = artifact
        .invoke_scalar_with_session(session(), "run", &arguments)
        .unwrap();
    assert_eq!(completion.backend, CoreRuntimeBackend::Wasmi);
    assert_eq!(
        completion.values,
        [
            CoreScalarValue::I64(42),
            CoreScalarValue::F32(f32::NAN.to_bits())
        ]
    );

    promote(&sdk, &artifact);
    let optimized = artifact
        .invoke_scalar_with_session(session(), "run", &arguments)
        .unwrap();
    assert_eq!(optimized.backend, CoreRuntimeBackend::Wasmtime);
    assert_eq!(optimized.values, completion.values);
}

#[test]
fn scalar_host_lane_returns_typed_state_after_success_and_callback_error() {
    let wasm = wat::parse_str(
        r#"(module
          (import "host" "respond" (func $respond (param i32) (result i32)))
          (func (export "run") (param i32) (result i32)
            local.get 0 call $respond))"#,
    )
    .unwrap();
    let import = CoreScalarHostImport::new(
        "host",
        "respond",
        vec![CoreScalarType::I32],
        vec![CoreScalarType::I32],
    );
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1)).unwrap();
    let artifact = sdk
        .prepare_scalar_host_core(&wasm, policy(21), std::slice::from_ref(&import))
        .unwrap();

    for expected_backend in [CoreRuntimeBackend::Wasmi, CoreRuntimeBackend::Wasmtime] {
        if expected_backend == CoreRuntimeBackend::Wasmtime {
            promote(&sdk, &artifact);
        }

        let success = CoreScalarHostSession::new(RequestState {
            calls: 0,
            body: Vec::new(),
        })
        .bind(import.clone(), |state, _memory, arguments| {
            state.calls += 1;
            state.body.extend_from_slice(b"ok");
            Ok(arguments.to_vec())
        });
        let outcome =
            artifact.invoke_scalar_with_session_state(success, "run", &[CoreScalarValue::I32(7)]);
        let invocation = outcome.invocation.unwrap();
        assert_eq!(invocation.backend, expected_backend);
        assert_eq!(invocation.values, [CoreScalarValue::I32(7)]);
        assert_eq!(
            outcome.state,
            RequestState {
                calls: 1,
                body: b"ok".to_vec(),
            }
        );

        let failure = CoreScalarHostSession::new(RequestState {
            calls: 0,
            body: Vec::new(),
        })
        .bind(import.clone(), |state, _memory, _arguments| {
            state.calls += 1;
            state.body.extend_from_slice(b"failed");
            Err(wasmc_core_runtime::CoreScalarHostError::callback(
                "expected callback failure",
            ))
        });
        let outcome =
            artifact.invoke_scalar_with_session_state(failure, "run", &[CoreScalarValue::I32(7)]);
        assert!(outcome.invocation.is_err());
        assert_eq!(
            outcome.state,
            RequestState {
                calls: 1,
                body: b"failed".to_vec(),
            }
        );
    }
}

#[test]
fn scalar_host_lane_cancels_without_replay_and_returns_state_on_both_engines() {
    let wasm = wat::parse_str(
        r#"(module
          (import "host" "mark" (func $mark (result i32)))
          (func (export "run") (result i32)
            call $mark
            drop
            (loop br 0)
            i32.const 0))"#,
    )
    .unwrap();
    let import = CoreScalarHostImport::new(
        "host",
        "mark",
        Vec::<CoreScalarType>::new(),
        vec![CoreScalarType::I32],
    );
    let profile = CoreRuntimeLimitProfile::bounded(
        1_000_000_000,
        1_000_000_000,
        1_000_000_000,
        1_000,
        65_536,
        1,
        1,
    );
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1).with_limits(profile)).unwrap();
    let artifact = sdk
        .prepare_scalar_host_core(&wasm, policy(22), std::slice::from_ref(&import))
        .unwrap();

    for expected_backend in [CoreRuntimeBackend::Wasmi, CoreRuntimeBackend::Wasmtime] {
        if expected_backend == CoreRuntimeBackend::Wasmtime {
            promote(&sdk, &artifact);
        }

        let cancelled_before_start = CoreRuntimeCancellation::new();
        cancelled_before_start.cancel();
        let session = CoreScalarHostSession::new(0_usize).bind(
            import.clone(),
            |state, _memory, _arguments| {
                *state += 1;
                Ok(vec![CoreScalarValue::I32(0)])
            },
        );
        let outcome = artifact.invoke_scalar_with_session_state_and_cancellation(
            session,
            "run",
            &[],
            &cancelled_before_start,
        );
        let error = outcome.invocation.unwrap_err();
        assert_eq!(error.backend, expected_backend);
        assert_eq!(error.code(), CoreRuntimeInvocationErrorCode::Cancelled);
        assert_eq!(
            outcome.state, 0,
            "pre-cancel must create no Store or effect"
        );

        let cancellation = CoreRuntimeCancellation::new();
        let callback_cancellation = cancellation.clone();
        let session = CoreScalarHostSession::new(0_usize).bind(
            import.clone(),
            move |state, _memory, _arguments| {
                *state += 1;
                callback_cancellation.cancel();
                Ok(vec![CoreScalarValue::I32(0)])
            },
        );
        let before_wasmi = artifact.status().wasmi_invocations;
        let before_wasmtime = artifact.status().wasmtime_invocations;
        let outcome = artifact.invoke_scalar_with_session_state_and_cancellation(
            session,
            "run",
            &[],
            &cancellation,
        );
        let error = outcome.invocation.unwrap_err();
        assert_eq!(error.backend, expected_backend);
        assert_eq!(error.code(), CoreRuntimeInvocationErrorCode::Cancelled);
        assert_eq!(outcome.state, 1);
        let status = artifact.status();
        assert_eq!(
            status.wasmi_invocations - before_wasmi + status.wasmtime_invocations - before_wasmtime,
            1,
            "cancelled execution must never replay on the other backend"
        );
    }
}

#[test]
fn scalar_host_lane_rejects_signature_drift_and_never_replays() {
    let wasm = wat::parse_str(
        r#"(module
          (import "host" "count" (func $count (param i64) (result i64)))
          (func (export "run") (param i64) (result i64)
            local.get 0 call $count))"#,
    )
    .unwrap();
    let wrong = CoreScalarHostImport::new(
        "host",
        "count",
        vec![CoreScalarType::I32],
        vec![CoreScalarType::I64],
    );
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1)).unwrap();
    assert!(sdk
        .prepare_scalar_host_core(&wasm, policy(19), &[wrong])
        .is_err());

    let import = CoreScalarHostImport::new(
        "host",
        "count",
        vec![CoreScalarType::I64],
        vec![CoreScalarType::I64],
    );
    let artifact = sdk
        .prepare_scalar_host_core(&wasm, policy(20), std::slice::from_ref(&import))
        .unwrap();
    promote(&sdk, &artifact);
    let session = CoreScalarHostSession::new(()).bind(import, |_state, _memory, _arguments| {
        Ok(vec![CoreScalarValue::I32(1)])
    });
    let error = artifact
        .invoke_scalar_with_session(session, "run", &[CoreScalarValue::I64(1)])
        .unwrap_err();
    assert_eq!(error.backend, CoreRuntimeBackend::Wasmtime);
    assert_eq!(artifact.status().wasmi_invocations, 0);
    assert_eq!(artifact.status().wasmtime_invocations, 1);
}

fn accept_candidate() -> CoreRuntimeOptimizationDecision {
    CoreRuntimeOptimizationDecision {
        behavior_parity: true,
        resource_parity: true,
        predicted_remaining_savings_ns: u64::MAX,
        contention_and_margin_ns: 0,
    }
}

fn promote(sdk: &CoreRuntimeSdk, artifact: &wasmc_core_runtime::CoreRuntimeArtifact) {
    assert!(sdk.request_optimization(artifact).unwrap());
    assert_eq!(
        artifact
            .wait_for_optimization(Duration::from_secs(10))
            .state,
        CoreRuntimeArtifactState::Candidate
    );
    assert!(artifact.publish(accept_candidate()).unwrap());
}

#[test]
fn standalone_sdk_completes_then_promotes_and_rolls_back() {
    let wasm = wat::parse_str(
        r#"(module
          (func (export "run") (param i32) (result i32)
            local.get 0 i32.const 1 i32.add))"#,
    )
    .unwrap();
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1)).unwrap();
    let artifact = sdk.prepare_core(&wasm, policy(1)).unwrap();

    assert_eq!(
        artifact.invoke_i32("run", 40).unwrap().backend,
        CoreRuntimeBackend::Wasmi
    );
    promote(&sdk, &artifact);
    assert_eq!(
        artifact.invoke_i32("run", 41).unwrap().backend,
        CoreRuntimeBackend::Wasmtime
    );
    assert!(artifact.rollback_to_completion());
    let rolled_back = artifact.invoke_i32("run", 41).unwrap();
    assert_eq!(rolled_back.backend, CoreRuntimeBackend::Wasmi);
    assert_eq!(rolled_back.value, 42);
}

#[test]
fn standalone_sdk_uses_exact_host_plan_on_both_engines() {
    let wasm = wat::parse_str(
        r#"(module
          (import "host" "double" (func $double (param i32) (result i32)))
          (func (export "run") (param i32) (result i32)
            local.get 0 call $double))"#,
    )
    .unwrap();
    let import = I32HostImport::new("host", "double");
    let calls = Arc::new(AtomicUsize::new(0));
    let binding = I32HostBinding::new(import.clone(), {
        let calls = Arc::clone(&calls);
        move |value| {
            calls.fetch_add(1, Ordering::Relaxed);
            value * 2
        }
    });
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1)).unwrap();
    let artifact = sdk
        .prepare_i32_host_core(&wasm, policy(2), &[import])
        .unwrap();

    assert_eq!(
        artifact
            .invoke_i32_with_host(std::slice::from_ref(&binding), "run", 20)
            .unwrap()
            .backend,
        CoreRuntimeBackend::Wasmi
    );
    promote(&sdk, &artifact);
    assert_eq!(
        artifact
            .invoke_i32_with_host(std::slice::from_ref(&binding), "run", 21)
            .unwrap()
            .backend,
        CoreRuntimeBackend::Wasmtime
    );
    assert_eq!(calls.load(Ordering::Relaxed), 2);
}

#[test]
fn selected_backend_failure_is_never_replayed() {
    let wasm = wat::parse_str(
        r#"(module
          (func (export "fail") (param i32) (result i32)
            local.get 0 i32.const 0 i32.div_s))"#,
    )
    .unwrap();
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1)).unwrap();
    let artifact = sdk.prepare_core(&wasm, policy(3)).unwrap();
    promote(&sdk, &artifact);

    let error = artifact.invoke_i32("fail", 1).unwrap_err();
    assert_eq!(error.backend, CoreRuntimeBackend::Wasmtime);
    assert!(error.to_string().contains("without replay"));
    let status = artifact.status();
    assert_eq!(status.wasmi_invocations, 0);
    assert_eq!(status.wasmtime_invocations, 1);
}

#[test]
fn i32_lane_shares_variable_arity_and_checked_memory_across_engines() {
    let wasm = wat::parse_str(
        r#"(module
          (import "host" "request-len" (func $request_len (result i32)))
          (import "host" "request-read" (func $request_read (param i32 i32 i32) (result i32)))
          (memory (export "memory") 1)
          (func (export "handle") (result i32)
            (local $len i32)
            call $request_len
            local.set $len
            i32.const 0
            i32.const 100
            local.get $len
            call $request_read
            drop
            i32.const 100
            i32.load8_u
            local.get $len
            i32.add))"#,
    )
    .unwrap();
    let request_len = I32LaneHostImport::new("host", "request-len", 0);
    let request_read = I32LaneHostImport::new("host", "request-read", 3);
    let calls = Arc::new(AtomicUsize::new(0));
    let bindings = || {
        vec![
            I32LaneHostBinding::new(request_len.clone(), |_memory, arguments| {
                assert!(arguments.is_empty());
                Ok(4)
            }),
            I32LaneHostBinding::new(request_read.clone(), {
                let calls = Arc::clone(&calls);
                move |memory, arguments| {
                    assert_eq!(arguments, [0, 100, 4]);
                    assert_eq!(memory.byte_len()?, 65_536);
                    let mut before = [0_u8; 4];
                    memory.read(100, &mut before)?;
                    assert_eq!(before, [0; 4], "each invocation must own fresh memory");
                    memory.write(100, &[10, 20, 30, 40])?;
                    calls.fetch_add(1, Ordering::Relaxed);
                    Ok(4)
                }
            }),
        ]
    };
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1)).unwrap();
    let artifact = sdk
        .prepare_i32_lane_host_core(
            &wasm,
            policy(4),
            &[request_len.clone(), request_read.clone()],
        )
        .unwrap();

    let completion = artifact
        .invoke_i32_lane_with_host(bindings(), "handle", &[])
        .unwrap();
    assert_eq!(completion.backend, CoreRuntimeBackend::Wasmi);
    assert_eq!(completion.value, 14);

    promote(&sdk, &artifact);
    let optimized = artifact
        .invoke_i32_lane_with_host(bindings(), "handle", &[])
        .unwrap();
    assert_eq!(optimized.backend, CoreRuntimeBackend::Wasmtime);
    assert_eq!(optimized.value, 14);
    assert_eq!(calls.load(Ordering::Relaxed), 2);
}

#[test]
fn i32_lane_memory_failure_on_selected_backend_is_not_replayed() {
    let wasm = wat::parse_str(
        r#"(module
          (import "host" "write" (func $write (param i32) (result i32)))
          (memory (export "memory") 1)
          (func (export "handle") (result i32)
            i32.const -1
            call $write))"#,
    )
    .unwrap();
    let import = I32LaneHostImport::new("host", "write", 1);
    let calls = Arc::new(AtomicUsize::new(0));
    let binding = I32LaneHostBinding::new(import.clone(), {
        let calls = Arc::clone(&calls);
        move |memory, arguments| {
            calls.fetch_add(1, Ordering::Relaxed);
            memory.write(arguments[0] as u32, &[1, 2, 3, 4])?;
            Ok(0)
        }
    });
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1)).unwrap();
    let artifact = sdk
        .prepare_i32_lane_host_core(&wasm, policy(5), &[import])
        .unwrap();
    promote(&sdk, &artifact);

    let error = artifact
        .invoke_i32_lane_with_host(vec![binding], "handle", &[])
        .unwrap_err();
    assert_eq!(error.backend, CoreRuntimeBackend::Wasmtime);
    assert!(error.to_string().contains("without replay"));
    assert_eq!(calls.load(Ordering::Relaxed), 1);
    let status = artifact.status();
    assert_eq!(status.wasmi_invocations, 0);
    assert_eq!(status.wasmtime_invocations, 1);
}

#[test]
fn i32_lane_binding_owns_lock_free_mutable_invocation_state() {
    let wasm = wat::parse_str(
        r#"(module
          (import "host" "next" (func $next (result i32)))
          (func (export "handle") (result i32)
            call $next
            call $next
            i32.add))"#,
    )
    .unwrap();
    let import = I32LaneHostImport::new("host", "next", 0);
    let binding = || {
        let mut value = 0;
        I32LaneHostBinding::new(import.clone(), move |_memory, arguments| {
            assert!(arguments.is_empty());
            value += 1;
            Ok(value)
        })
    };
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1)).unwrap();
    let artifact = sdk
        .prepare_i32_lane_host_core(&wasm, policy(6), std::slice::from_ref(&import))
        .unwrap();

    assert_eq!(
        artifact
            .invoke_i32_lane_with_host(vec![binding()], "handle", &[])
            .unwrap()
            .value,
        3
    );
    promote(&sdk, &artifact);
    assert_eq!(
        artifact
            .invoke_i32_lane_with_host(vec![binding()], "handle", &[])
            .unwrap()
            .value,
        3
    );
}

#[test]
fn i32_lane_session_shares_one_typed_state_across_imports() {
    let wasm = wat::parse_str(
        r#"(module
          (import "host" "add" (func $add (param i32) (result i32)))
          (import "host" "read" (func $read (result i32)))
          (func (export "handle") (result i32)
            i32.const 7
            call $add
            drop
            call $read))"#,
    )
    .unwrap();
    let add = I32LaneHostImport::new("host", "add", 1);
    let read = I32LaneHostImport::new("host", "read", 0);
    let session = || {
        I32LaneHostSession::new(10_i32)
            .bind(add.clone(), |state, _memory, arguments| {
                *state += arguments[0];
                Ok(0)
            })
            .bind(read.clone(), |state, _memory, arguments| {
                assert!(arguments.is_empty());
                Ok(*state)
            })
    };
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1)).unwrap();
    let artifact = sdk
        .prepare_i32_lane_host_core(&wasm, policy(7), &[add.clone(), read.clone()])
        .unwrap();

    let completion = artifact
        .invoke_i32_lane_with_session(session(), "handle", &[])
        .unwrap();
    assert_eq!(completion.backend, CoreRuntimeBackend::Wasmi);
    assert_eq!(completion.value, 17);

    promote(&sdk, &artifact);
    let optimized = artifact
        .invoke_i32_lane_with_session(session(), "handle", &[])
        .unwrap();
    assert_eq!(optimized.backend, CoreRuntimeBackend::Wasmtime);
    assert_eq!(optimized.value, 17);
}

fn bounded_profile(max_concurrent_stores: usize) -> CoreRuntimeLimitProfile {
    CoreRuntimeLimitProfile::bounded(
        1_000_000,
        1_000_000,
        100_000_000,
        10_000,
        65_536,
        1_024,
        max_concurrent_stores,
    )
}

#[test]
fn bounded_profile_is_complete_and_part_of_exact_identity() {
    let invalid = CoreRuntimeLimitProfile::bounded(0, 1, 1, 1, 1, 1, 1);
    let error = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1).with_limits(invalid))
        .err()
        .expect("zero fuel must reject the complete profile");
    assert!(error.to_string().contains("must be positive"));

    let invalid = CoreRuntimeLimitProfile::bounded(100, 100, 999_999, 10, 1, 1, 1);
    let error = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1).with_limits(invalid))
        .err()
        .expect("sub-millisecond wall-clock limits must reject");
    assert!(error.to_string().contains("at least 1 millisecond"));

    let invalid = CoreRuntimeLimitProfile::bounded(100, 100, 1_000_000, 101, 1, 1, 1);
    let error = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1).with_limits(invalid))
        .err()
        .expect("Wasmi quantum above total fuel must reject");
    assert!(error.to_string().contains("cannot exceed"));

    let profile = bounded_profile(1);
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1).with_limits(profile)).unwrap();
    let wasm =
        wat::parse_str(r#"(module (func (export "run") (param i32) (result i32) local.get 0))"#)
            .unwrap();
    let artifact = sdk.prepare_core(&wasm, policy(8)).unwrap();
    assert_eq!(artifact.identity().limit_profile(), profile);
}

#[test]
fn concurrent_store_limit_rejects_before_effect_on_both_engines() {
    use std::{sync::mpsc, thread};

    let wasm = wat::parse_str(
        r#"(module
          (import "host" "hold" (func $hold (result i32)))
          (func (export "run") (result i32) call $hold))"#,
    )
    .unwrap();
    let import = I32LaneHostImport::new("host", "hold", 0);
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1).with_limits(bounded_profile(1)))
        .unwrap();
    let artifact = sdk
        .prepare_i32_lane_host_core(&wasm, policy(9), std::slice::from_ref(&import))
        .unwrap();

    for expected_backend in [CoreRuntimeBackend::Wasmi, CoreRuntimeBackend::Wasmtime] {
        if expected_backend == CoreRuntimeBackend::Wasmtime {
            promote(&sdk, &artifact);
        }
        let (entered_tx, entered_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();
        let blocking = I32LaneHostSession::new((entered_tx, release_rx)).bind(
            import.clone(),
            |state, _memory, arguments| {
                assert!(arguments.is_empty());
                state.0.send(()).unwrap();
                state.1.recv().unwrap();
                Ok(7)
            },
        );
        let active_artifact = artifact.clone();
        let active = thread::spawn(move || {
            active_artifact.invoke_i32_lane_with_session(blocking, "run", &[])
        });
        entered_rx.recv().unwrap();

        let rejected = artifact
            .invoke_i32_lane_with_host(
                vec![I32LaneHostBinding::new(
                    import.clone(),
                    |_memory, _arguments| Ok(99),
                )],
                "run",
                &[],
            )
            .unwrap_err();
        assert_eq!(rejected.backend, expected_backend);
        assert_eq!(
            rejected.code(),
            CoreRuntimeInvocationErrorCode::ResourceLimit
        );
        assert!(rejected.to_string().contains("before Store creation"));

        release_tx.send(()).unwrap();
        let completed = active.join().unwrap().unwrap();
        assert_eq!(completed.backend, expected_backend);
        assert_eq!(completed.value, 7);
        assert_eq!(
            artifact
                .invoke_i32_lane_with_host(
                    vec![I32LaneHostBinding::new(
                        import.clone(),
                        |_memory, _arguments| Ok(11),
                    )],
                    "run",
                    &[],
                )
                .unwrap()
                .value,
            11,
            "permit must be released after the active Store is dropped"
        );
    }
}

#[test]
fn fuel_memory_and_table_limits_reject_on_both_engines() {
    let profile = CoreRuntimeLimitProfile::bounded(1_000, 1_000, 100_000_000, 100, 65_536, 1, 1);
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(8, 2).with_limits(profile)).unwrap();
    let cases = [
        (
            "fuel",
            r#"(module
              (func (export "run") (param i32) (result i32)
                (loop br 0)
                i32.const 0))"#,
        ),
        (
            "memory",
            r#"(module
              (memory 1)
              (func (export "run") (param i32) (result i32)
                i32.const 1 memory.grow))"#,
        ),
        (
            "table",
            r#"(module
              (table 1 funcref)
              (func (export "run") (param i32) (result i32)
                ref.null func i32.const 1 table.grow))"#,
        ),
    ];

    for (index, (name, wat)) in cases.into_iter().enumerate() {
        let wasm = wat::parse_str(wat).unwrap();
        let artifact = sdk.prepare_core(&wasm, policy(20 + index as u8)).unwrap();
        let completion = artifact.invoke_i32("run", 0).unwrap_err();
        assert_eq!(completion.backend, CoreRuntimeBackend::Wasmi, "{name}");
        assert_eq!(
            completion.code(),
            CoreRuntimeInvocationErrorCode::ResourceLimit,
            "{name}: {completion}"
        );
        promote(&sdk, &artifact);
        let optimized = artifact.invoke_i32("run", 0).unwrap_err();
        assert_eq!(optimized.backend, CoreRuntimeBackend::Wasmtime, "{name}");
        assert_eq!(
            optimized.code(),
            CoreRuntimeInvocationErrorCode::ResourceLimit,
            "{name}: {optimized}"
        );
    }
}

#[test]
fn guest_wall_clock_limit_interrupts_both_engines() {
    use std::time::Instant;

    let profile = CoreRuntimeLimitProfile::bounded(
        1_000_000_000_000,
        1_000_000_000_000,
        5_000_000,
        1_000,
        65_536,
        1,
        1,
    );
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1).with_limits(profile)).unwrap();
    let wasm = wat::parse_str(
        r#"(module
          (func (export "run") (param i32) (result i32)
            (loop br 0)
            i32.const 0))"#,
    )
    .unwrap();
    let artifact = sdk.prepare_core(&wasm, policy(30)).unwrap();

    for expected_backend in [CoreRuntimeBackend::Wasmi, CoreRuntimeBackend::Wasmtime] {
        if expected_backend == CoreRuntimeBackend::Wasmtime {
            promote(&sdk, &artifact);
        }
        let started = Instant::now();
        let error = artifact.invoke_i32("run", 0).unwrap_err();
        assert_eq!(error.backend, expected_backend);
        assert_eq!(
            error.code(),
            CoreRuntimeInvocationErrorCode::ResourceLimit,
            "{expected_backend:?}: {error}"
        );
        assert!(
            started.elapsed() < Duration::from_millis(500),
            "{expected_backend:?} did not interrupt within the bounded test window: {error}"
        );
    }
}

#[test]
fn i32_lane_applies_store_limits_without_replay_on_both_engines() {
    let profile =
        CoreRuntimeLimitProfile::bounded(1_000_000, 1_000_000, 100_000_000, 1_000, 65_536, 1, 1);
    let sdk = CoreRuntimeSdk::new(CoreRuntimeSdkConfig::new(4, 1).with_limits(profile)).unwrap();
    let wasm = wat::parse_str(
        r#"(module
          (import "host" "observe" (func $observe (result i32)))
          (memory 1)
          (func (export "run") (result i32)
            call $observe drop
            i32.const 1 memory.grow))"#,
    )
    .unwrap();
    let import = I32LaneHostImport::new("host", "observe", 0);
    let artifact = sdk
        .prepare_i32_lane_host_core(&wasm, policy(31), std::slice::from_ref(&import))
        .unwrap();
    let calls = Arc::new(AtomicUsize::new(0));

    for expected_backend in [CoreRuntimeBackend::Wasmi, CoreRuntimeBackend::Wasmtime] {
        if expected_backend == CoreRuntimeBackend::Wasmtime {
            promote(&sdk, &artifact);
        }
        let binding = I32LaneHostBinding::new(import.clone(), {
            let calls = Arc::clone(&calls);
            move |_memory, arguments| {
                assert!(arguments.is_empty());
                calls.fetch_add(1, Ordering::Relaxed);
                Ok(0)
            }
        });
        let error = artifact
            .invoke_i32_lane_with_host(vec![binding], "run", &[])
            .unwrap_err();
        assert_eq!(error.backend, expected_backend);
        assert_eq!(
            error.code(),
            CoreRuntimeInvocationErrorCode::ResourceLimit,
            "{expected_backend:?}: {error}"
        );
    }
    assert_eq!(calls.load(Ordering::Relaxed), 2);
}
