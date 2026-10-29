use std::{env,fs,path::Path};
use wasmc::lib_tool_rust_consumer_sdk::generate_rust_canonical_core_consumer_sdk;
use wasmc::self_bundle::{hex,sha256};
fn main()->Result<(),Box<dyn std::error::Error>>{
 let a:Vec<_>=env::args().collect();assert_eq!(a.len(),3);let root=Path::new(&a[1]);let out=Path::new(&a[2]);fs::create_dir(out)?;
 let manifest:serde_json::Value=serde_json::from_slice(&fs::read(root.join("lib.json"))?)?;
 let id=manifest["id"].as_str().ok_or("missing id")?;let version=manifest["version"].as_str().ok_or("missing version")?;
 let w=fs::read(root.join("lib.wit"))?;let artifact=fs::read(root.join("artifact.wasm"))?;let wit=std::str::from_utf8(&w)?;
 let generated=generate_rust_canonical_core_consumer_sdk(id,version,wit,&artifact,&hex(&sha256(&artifact)),&hex(&sha256(&w)))?;
 fs::write(out.join("lib.rs"),&generated.source)?;fs::write(out.join("Cargo.toml"),&generated.cargo_toml)?;
 println!("{}",serde_json::json!({"id":id,"version":version,"functions":generated.function_count,"sdk_sha256":hex(&sha256(&generated.source)),"artifact_sha256":hex(&sha256(&artifact)),"wit_sha256":hex(&sha256(&w))}));Ok(())
}
