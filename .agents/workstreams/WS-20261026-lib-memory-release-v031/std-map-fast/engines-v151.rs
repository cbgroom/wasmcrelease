use std::{env, fs, path::Path};
const PROVIDER: &str = "wasmc:lib/wasmc.lib_managed_object_heap@4.9.0";
const STD: &str = "wasmc:lib/wasmc.std@1.5.1";
fn wasmi_run(provider: &[u8], root: &[u8], app: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    let engine = wasmi::Engine::default();
    let mut store = wasmi::Store::new(&engine, ());
    let mut linker = wasmi::Linker::new(&engine);
    let p = linker.instantiate_and_start(&mut store, &wasmi::Module::new(&engine, provider)?)?;
    assert_eq!(
        p.get_typed_func::<(i32, i32), i32>(&store, "provider_domain_init")?
            .call(&mut store, (109, 53))?,
        0
    );
    linker.instance(&mut store, PROVIDER, p)?;
    let r = linker.instantiate_and_start(&mut store, &wasmi::Module::new(&engine, root)?)?;
    assert_eq!(
        r.get_typed_func::<(), i32>(&store, "std_init")?
            .call(&mut store, ())?,
        0
    );
    linker.instance(&mut store, STD, r)?;
    let a = linker.instantiate_and_start(&mut store, &wasmi::Module::new(&engine, app)?)?;
    let run = a.get_typed_func::<(), i32>(&store, "run")?;
    for _ in 0..256 {
        assert_eq!(run.call(&mut store, ())?, 73);
    }
    println!(
        r#"{{"engine":"wasmi","version":"2.0.0","accepted":true,"rounds":256,"persistent_instances":true}}"#
    );
    Ok(())
}
fn wasmtime_run(
    provider: &[u8],
    root: &[u8],
    app: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    let engine = wasmtime::Engine::default();
    let mut store = wasmtime::Store::new(&engine, ());
    let mut linker = wasmtime::Linker::new(&engine);
    let p = linker.instantiate(&mut store, &wasmtime::Module::new(&engine, provider)?)?;
    assert_eq!(
        p.get_typed_func::<(i32, i32), i32>(&mut store, "provider_domain_init")?
            .call(&mut store, (109, 53))?,
        0
    );
    linker.instance(&mut store, PROVIDER, p)?;
    let r = linker.instantiate(&mut store, &wasmtime::Module::new(&engine, root)?)?;
    assert_eq!(
        r.get_typed_func::<(), i32>(&mut store, "std_init")?
            .call(&mut store, ())?,
        0
    );
    linker.instance(&mut store, STD, r)?;
    let a = linker.instantiate(&mut store, &wasmtime::Module::new(&engine, app)?)?;
    let run = a.get_typed_func::<(), i32>(&mut store, "run")?;
    for _ in 0..256 {
        assert_eq!(run.call(&mut store, ())?, 73);
    }
    println!(
        r#"{{"engine":"wasmtime","version":"49.0.2","accepted":true,"rounds":256,"persistent_instances":true}}"#
    );
    Ok(())
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = env::args().collect();
    assert_eq!(args.len(), 4);
    let package = Path::new(&args[1]);
    let provider = fs::read(&args[3])?;
    let root = fs::read(package.join("artifact.wasm"))?;
    let app = fs::read(&args[2])?;
    wasmi_run(&provider, &root, &app)?;
    wasmtime_run(&provider, &root, &app)?;
    Ok(())
}
