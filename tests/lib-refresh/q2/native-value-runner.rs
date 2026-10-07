//! Maintainer-only integration harness. It consumes an exact generated Root;
//! no Lib implementation or old package is compiled into the App.
use std::{error::Error, fs, path::{Path, PathBuf}, process::Command};
use serde_json::{json, Value};
use wasmc::lib_tool_rust_consumer_sdk::{
    generate_rust_wit_canonical_value_core_bridge,
    native_build::{NativePinnedFile, NativePinnedRoot, NativeRootBuildPlan, NativeRootBuildSession},
    native_invoke::NativeLogicalApp,
};

fn pin(bytes: &[u8]) -> String { wasmc::self_bundle::hex(&wasmc::self_bundle::sha256(bytes)) }
fn read_pin(path: &Path, expected: &str) -> Result<Vec<u8>, Box<dyn Error>> {
    let bytes = fs::read(path)?;
    if pin(&bytes) != expected { return Err(format!("identity mismatch: {}", path.display()).into()); }
    Ok(bytes)
}
fn wasmtime_scalar(bundle: &Path, name: &str, kind: &str) -> Result<Value, Box<dyn Error>> {
    let manifest: Value = serde_json::from_slice(&fs::read(bundle.join("bundle.json"))?)?;
    let provider = read_pin(&bundle.join("provider.wasm"), manifest["receipt"]["provider_sha256"].as_str().ok_or("provider pin")?)?;
    let application = read_pin(&bundle.join("app.wasm"), manifest["receipt"]["app_sha256"].as_str().ok_or("App pin")?)?;
    let mut config = wasmtime::Config::new(); config.consume_fuel(true);
    let engine = wasmtime::Engine::new(&config)?;
    let limits = wasmtime::StoreLimitsBuilder::new().memory_size(16*1024*1024).instances(3).memories(8).tables(8).build();
    let mut store = wasmtime::Store::new(&engine, limits);store.limiter(|limits| limits);store.set_fuel(u64::MAX)?;
    let heap = wasmtime::Instance::new(&mut store, &wasmtime::Module::new(&engine, provider)?, &[])?;
    let module = wasmtime::Module::new(&engine, application)?;
    let mut linker = wasmtime::Linker::new(&engine);
    for import in module.imports() {
        if !matches!(import.module(),"wasmc-snapshot-provider"|"wasmc:lib/wasmc.lib_managed_object_heap@4.3.0") {
            return Err("unexpected App capability".into());
        }
        let export=heap.get_export(&mut store,import.name()).ok_or("missing CoreLib export")?;
        linker.define(&mut store,import.module(),import.name(),export)?;
    }
    let app=linker.instantiate(&mut store,&module)?;
    let value=match kind {
        "s32"=>json!(app.get_typed_func::<(),i32>(&mut store,name)?.call(&mut store,())?),
        "u32"=>json!(app.get_typed_func::<(),i32>(&mut store,name)?.call(&mut store,())? as u32),
        "s64"=>json!(app.get_typed_func::<(),i64>(&mut store,name)?.call(&mut store,())?.to_string()),
        "bool"=>{let n=app.get_typed_func::<(),i32>(&mut store,name)?.call(&mut store,())?;if !matches!(n,0|1){return Err("invalid bool".into())}json!(n==1)},
        _=>return Err("unsupported scalar control".into()),
    };
    if app.get_typed_func::<(),i32>(&mut store,"__wasmc_value_pending_allocations")?.call(&mut store,())? != 0 {
        return Err("pending transfer allocations after scalar App call".into());
    }
    Ok(value)
}
fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args.len() != 2 { return Err("usage: runner <input-plan.json> <absent-output-dir>".into()); }
    let input: Value = serde_json::from_slice(&fs::read(&args[0])?)?;
    let root = PathBuf::from(input["root"]["path"].as_str().ok_or("root path")?);
    let root_pin = input["root"]["manifest_sha256"].as_str().ok_or("manifest pin")?;
    let manifest: Value = serde_json::from_slice(&read_pin(&root.join("lib.json"), root_pin)?)?;
    let artifact = read_pin(&root.join("artifact.wasm"), manifest["artifact"]["sha256"].as_str().ok_or("artifact pin")?)?;
    let wit = fs::read(root.join("lib.wit"))?;
    let module = manifest["bindings"]["rust_core"]["import_module"].as_str().ok_or("complete canonical Core view required")?;
    let output = PathBuf::from(&args[1]);
    if !output.is_absolute() || output.exists() { return Err("output must be absent and absolute".into()); }
    fs::create_dir(&output)?;
    let source = fs::read_to_string(input["source"].as_str().ok_or("source path")?)?;
    let cases: Vec<Value> = serde_json::from_slice(&fs::read(input["cases"].as_str().ok_or("cases path")?)?)?;
    let execute = || -> Result<Value, Box<dyn Error>> {
        let mut bridge = generate_rust_wit_canonical_value_core_bridge(&artifact, &pin(&artifact), &wit, &pin(&wit), module)?;
        bridge.source.push_str("\n#[export_name=\"allocate\"] pub unsafe extern \"C\" fn __q2_allocate(n:u32,a:u32)->u32 { __wasmc_canonical_transfer::__wasmc_value_stage_allocate(n,a) }\n");
        let transfer_source = output.join("transfer.rs");
        fs::write(&transfer_source, bridge.source)?;
        let transfer = output.join("transfer.wasm");
        let built = Command::new("rustc").args([
            "+1.96.0", "--edition=2021", "--crate-type=cdylib", "--target=wasm32-unknown-unknown",
            "-Cpanic=abort", "-Copt-level=s", "-Clto=fat", "-Cstrip=symbols",
        ]).arg(&transfer_source).arg("-o").arg(&transfer).output()?;
        fs::write(output.join("transfer.stdout"), &built.stdout)?;
        fs::write(output.join("transfer.stderr"), &built.stderr)?;
        if !built.status.success() { return Err("transfer compilation failed; inspect retained stderr".into()); }
        let provider: NativePinnedFile = serde_json::from_value(input["provider"].clone())?;
        let merge_tool: NativePinnedFile = serde_json::from_value(input["merge_tool"].clone())?;
        let plan = NativeRootBuildPlan {
            schema:"wasmc.native-root-build-plan/v1".into(),
            root:NativePinnedRoot { path:root.clone(), manifest_sha256:root_pin.into() },
            transfer:NativePinnedFile { path:transfer.clone(), sha256:pin(&fs::read(&transfer)?) },
            provider, merge_tool, domain:81,
        };
        fs::write(output.join("build-plan.json"), serde_json::to_vec_pretty(&plan)?)?;
        let mut wrong_plan = plan.clone();
        wrong_plan.root.manifest_sha256 = "0".repeat(64);
        if NativeRootBuildSession::acquire(&wrong_plan).is_ok() { return Err("wrong manifest pin accepted".into()); }
        let session = NativeRootBuildSession::acquire(&plan)?;
        let bundle = output.join("app");
        let build = session.build(&source, &bundle)?;
        let bundle_pin = pin(&fs::read(bundle.join("bundle.json"))?);
        if NativeLogicalApp::acquire(&bundle, &"0".repeat(64)).is_ok() { return Err("wrong bundle pin accepted".into()); }
        let app = NativeLogicalApp::acquire(&bundle, &bundle_pin)?;
        let mut observations = Vec::new();
        for case in &cases {
            let name = case["export"].as_str().ok_or("case export")?;
            let arguments = case["arguments"].as_array().ok_or("case arguments")?;
            let expected = &case["expected"];
            let wasmi = app.invoke(name, arguments)?;
            if &wasmi != expected {
                return Err(format!("{name}: expected {expected}; Wasmi {wasmi}").into());
            }
            let wasmtime = match case["wasmtime_scalar"].as_str() {
                Some(kind) => {
                    if !arguments.is_empty() {return Err("scalar control expects no parameters".into());}
                    let actual=wasmtime_scalar(&bundle,name,kind)?;
                    if &actual != expected {return Err(format!("{name}: Wasmtime {actual}, expected {expected}").into());}
                    json!({"tested":true,"value":actual})
                }
                None => json!({"tested":false,"reason":"complex logical Wasmtime invocation is not exported by the current maintainer API"}),
            };
            observations.push(json!({"export":name,"wasmi":wasmi,"wasmtime":wasmtime}));
        }
        Ok(json!({"schema":"wasmc.generated-root-ordinary-caller-q2/v1","accepted":true,
            "root_manifest_sha256":root_pin,"artifact_sha256":pin(&artifact),"wit_sha256":pin(&wit),
            "source_sha256":pin(source.as_bytes()),"build":build,"bundle_sha256":bundle_pin,
            "cases":observations,"wasmi_version":"2.0.0","wasmtime_version":"49.0.2",
            "wrong_root_pin_rejected":true,"wrong_bundle_pin_rejected":true,
            "ordinary_wasmc_source":true,"fuel_diagnostic_only":true,
            "invocation_scope":"new bounded Store per invocation; not persistent Store soak",
            "public_admission":false}))
    };
    match execute() {
        Ok(report) => { fs::write(output.join("receipt.json"),serde_json::to_vec_pretty(&report)?)?; println!("{report}"); Ok(()) }
        Err(error) => {
            let report=json!({"schema":"wasmc.generated-root-ordinary-caller-q2/v1","accepted":false,
                "root_manifest_sha256":root_pin,"source_sha256":pin(source.as_bytes()),"error":error.to_string(),"public_admission":false});
            fs::write(output.join("receipt.json"),serde_json::to_vec_pretty(&report)?)?;
            Err(error)
        }
    }
}
