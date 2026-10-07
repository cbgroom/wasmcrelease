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
    let rounds=input.get("rounds").map(|n|n.as_u64().ok_or("invalid rounds")).transpose()?.unwrap_or(1);
    if cases.is_empty() || cases.len()>128 || !(1..=128).contains(&rounds) {return Err("case/round budget".into());}
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
        for round in 0..rounds {
        for case in &cases {
            let name = case["export"].as_str().ok_or("case export")?;
            let arguments = case["arguments"].as_array().ok_or("case arguments")?;
            let expected = &case["expected"];
            let wasmi = app.invoke(name, arguments)?;
            if &wasmi != expected {
                return Err(format!("{name}: expected {expected}; Wasmi {wasmi}").into());
            }
            let actual=app.invoke_with_wasmtime(name,arguments)?;
            if &actual != expected {return Err(format!("{name} round {round}: Wasmtime {actual}, expected {expected}").into());}
            if round==0 {observations.push(json!({"export":name,"wasmi":wasmi,"wasmtime":{"tested":true,"value":actual}}));}
        }
        }
        if app.invoke("__invalid_q2_export",&[]).is_ok() || app.invoke_with_wasmtime("__invalid_q2_export",&[]).is_ok() {return Err("unknown export accepted".into());}
        Ok(json!({"schema":"wasmc.generated-root-ordinary-caller-q2/v2","accepted":true,
            "root_manifest_sha256":root_pin,"artifact_sha256":pin(&artifact),"wit_sha256":pin(&wit),
            "source_sha256":pin(source.as_bytes()),"build":build,"bundle_sha256":bundle_pin,
            "cases":observations,"wasmi_version":"2.0.0","wasmtime_version":"49.0.2",
            "rounds":rounds,"calls_per_engine":cases.len() as u64*rounds,"all_cases_dual_engine":true,
            "unknown_export_rejected":true,"shared_logical_decoder":true,
            "wrong_root_pin_rejected":true,"wrong_bundle_pin_rejected":true,
            "ordinary_wasmc_source":true,"fuel_diagnostic_only":true,
            "invocation_scope":"new bounded Store per invocation; not persistent Store soak",
            "public_admission":false}))
    };
    match execute() {
        Ok(report) => { fs::write(output.join("receipt.json"),serde_json::to_vec_pretty(&report)?)?; println!("{report}"); Ok(()) }
        Err(error) => {
            let report=json!({"schema":"wasmc.generated-root-ordinary-caller-q2/v2","accepted":false,
                "root_manifest_sha256":root_pin,"source_sha256":pin(source.as_bytes()),"error":error.to_string(),"public_admission":false});
            fs::write(output.join("receipt.json"),serde_json::to_vec_pretty(&report)?)?;
            Err(error)
        }
    }
}
