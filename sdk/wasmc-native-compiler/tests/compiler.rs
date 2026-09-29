use wasmc_native_compiler::{Compiler, Limits};

#[test]
fn ordinary_u64_executes_identically_on_wasmi_and_wasmtime() {
    let source = r#"package local:u64_engine_receipt;
interface api {
 max: func()->u64 { return 18446744073709551615; }
 shift: func(x:u64)->u64 { return x >> 63; }
}
world app { export api; }"#;
    let wasm = Compiler::new(Limits::default()).unwrap().compile(source).unwrap();

    let wasmi_engine = wasmi::Engine::default();
    let wasmi_module = wasmi::Module::new(&wasmi_engine, &wasm).unwrap();
    let mut wasmi_store = wasmi::Store::new(&wasmi_engine, ());
    let wasmi_instance = wasmi::Linker::new(&wasmi_engine)
        .instantiate_and_start(&mut wasmi_store, &wasmi_module)
        .unwrap();
    assert_eq!(
        wasmi_instance
            .get_typed_func::<(), i64>(&wasmi_store, "max")
            .unwrap()
            .call(&mut wasmi_store, ())
            .unwrap(),
        -1
    );
    assert_eq!(
        wasmi_instance
            .get_typed_func::<i64, i64>(&wasmi_store, "shift")
            .unwrap()
            .call(&mut wasmi_store, -1)
            .unwrap(),
        1
    );

    let wasmtime_engine = wasmtime::Engine::default();
    let wasmtime_module = wasmtime::Module::new(&wasmtime_engine, &wasm).unwrap();
    let mut wasmtime_store = wasmtime::Store::new(&wasmtime_engine, ());
    let wasmtime_instance = wasmtime::Instance::new(
        &mut wasmtime_store,
        &wasmtime_module,
        &[],
    )
    .unwrap();
    assert_eq!(
        wasmtime_instance
            .get_typed_func::<(), i64>(&mut wasmtime_store, "max")
            .unwrap()
            .call(&mut wasmtime_store, ())
            .unwrap(),
        -1
    );
    assert_eq!(
        wasmtime_instance
            .get_typed_func::<i64, i64>(&mut wasmtime_store, "shift")
            .unwrap()
            .call(&mut wasmtime_store, -1)
            .unwrap(),
        1
    );
}

#[test]
fn resident_diagnostic_recovery_and_repeat() {
    let mut compiler = Compiler::new(Limits::default()).unwrap();
    let source = include_str!("../../../examples/agent-start/01_add.wasmc");
    let first = compiler.compile(source).unwrap();
    assert_eq!(&first[..4], b"\0asm");
    assert!(compiler.compile("invalid source").is_err());
    assert_eq!(first, compiler.compile(source).unwrap());
}
#[test]
fn rejects_source_and_zero_limits() {
    assert!(Compiler::new(Limits {
        fuel: 0,
        ..Limits::default()
    })
    .is_err());
    let mut compiler = Compiler::new(Limits {
        source_bytes: 1,
        ..Limits::default()
    })
    .unwrap();
    assert!(compiler.compile("too large").is_err());
}
#[test]
fn fuel_exhaustion_poisoned_instance() {
    let mut compiler = Compiler::new(Limits {
        fuel: 100,
        ..Limits::default()
    })
    .unwrap();
    let source = include_str!("../../../examples/agent-start/01_add.wasmc");
    assert!(compiler.compile(source).is_err());
    assert_eq!(
        compiler.compile(source).unwrap_err(),
        "compiler instance poisoned"
    );
}
