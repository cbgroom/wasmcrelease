//! Public artifact conformance, not SDK mechanics or portable-Std acceptance.
use sha2::{Digest, Sha256};

const PROVIDER: &[u8] = include_bytes!("../../../standard/corelib/4.8.0/corelib.wasm");
const STANDARD: &[u8] = include_bytes!("../../../standard/wasmc-std/1.4.0/artifact.wasm");
const WASMC: &[u8] = include_bytes!("../../../examples/current/standard-wasmc.wasm");
const RUST: &[u8] = include_bytes!("../../../examples/current/standard-rust.wasm");
const PROVIDER_NAMESPACE: &str = "wasmc:lib/wasmc.lib_managed_object_heap@4.8.0";
const STANDARD_NAMESPACE: &str = "wasmc:lib/wasmc.std@1.4.0";

fn verify_identity() {
    assert_eq!(
        format!("{:x}", Sha256::digest(PROVIDER)),
        "f54a892aff9068e5c79464029423a2e8f753ddb44010af9ac34a5c9efce2069c"
    );
    assert_eq!(
        format!("{:x}", Sha256::digest(STANDARD)),
        "f8a8ce447f776a47680e02e19ea3a69827edbbc46e01985803ce3d3df51178d7"
    );
}

#[cfg(feature = "wasmi-runtime")]
#[test]
fn current_standard_wasmi_rejection_is_not_portable_acceptance() {
    verify_identity();
    let engine = wasmi::Engine::default();
    let provider = wasmi::Module::new(&engine, PROVIDER).unwrap();
    assert_eq!(provider.imports().count(), 0);
    let mut store = wasmi::Store::new(&engine, ());
    let instance = wasmi::Linker::new(&engine)
        .instantiate_and_start(&mut store, &provider)
        .unwrap();
    assert_eq!(
        instance
            .get_typed_func::<(i32, i32), i32>(&store, "provider_domain_init")
            .unwrap()
            .call(&mut store, (127, 7))
            .unwrap(),
        0
    );
    wasmi::Module::new(&engine, WASMC).expect("WAsmC caller must validate independently");
    wasmi::Module::new(&engine, RUST).expect("Rust caller must validate independently");
    let error = match wasmi::Module::new(&engine, STANDARD) {
        Ok(_) => panic!("engine now accepts current Std; replace negative boundary with complete graph acceptance"),
        Err(error) => error.to_string(),
    };
    assert!(
        error.contains("function references"),
        "unexpected rejection: {error}"
    );
}

#[cfg(feature = "wasmtime-runtime")]
#[test]
fn current_standard_wasmtime_complete_dual_consumer_graph() {
    verify_identity();
    let mut config = wasmtime::Config::new();
    config.wasm_function_references(true).wasm_tail_call(true);
    let engine = wasmtime::Engine::new(&config).unwrap();
    let provider = wasmtime::Module::new(&engine, PROVIDER).unwrap();
    assert_eq!(provider.imports().count(), 0);
    let standard = wasmtime::Module::new(&engine, STANDARD).unwrap();
    assert!(standard
        .imports()
        .all(|import| import.module() == PROVIDER_NAMESPACE));
    let mut total_calls = 0;
    for (bytes, multi_value) in [(WASMC, true), (RUST, false)] {
        let app = wasmtime::Module::new(&engine, bytes).unwrap();
        assert!(app
            .imports()
            .all(|import| import.module() == STANDARD_NAMESPACE));
        let mut store = wasmtime::Store::new(&engine, ());
        let mut linker = wasmtime::Linker::new(&engine);
        let p = linker.instantiate(&mut store, &provider).unwrap();
        assert_eq!(
            p.get_typed_func::<(i32, i32), i32>(&mut store, "provider_domain_init")
                .unwrap()
                .call(&mut store, (127, 7))
                .unwrap(),
            0
        );
        linker.instance(&mut store, PROVIDER_NAMESPACE, p).unwrap();
        let std = linker.instantiate(&mut store, &standard).unwrap();
        assert_eq!(
            std.get_typed_func::<(), i32>(&mut store, "std_init")
                .unwrap()
                .call(&mut store, ())
                .unwrap(),
            0
        );
        linker
            .instance(&mut store, STANDARD_NAMESPACE, std)
            .unwrap();
        let a = linker.instantiate(&mut store, &app).unwrap();
        for _ in 0..128 {
            for index in [0_u32, 1, 2, 99, u32::MAX] {
                for item in [0_i32, 1, 128, 255] {
                    let expected = match index {
                        0 => -7,
                        1 => 0,
                        2 => i32::MAX,
                        _ => 9,
                    };
                    let args = (index as i32, item);
                    if multi_value {
                        assert_eq!(
                            a.get_typed_func::<(i32, i32), (i32, i32)>(&mut store, "run")
                                .unwrap()
                                .call(&mut store, args)
                                .unwrap(),
                            (expected, 0)
                        );
                    } else {
                        assert_eq!(
                            a.get_typed_func::<(i32, i32), i32>(&mut store, "run")
                                .unwrap()
                                .call(&mut store, args)
                                .unwrap(),
                            expected
                        );
                    }
                    total_calls += 1;
                }
            }
        }
    }
    assert_eq!(total_calls, 5120);
}
