//! Release-owned glue invoking the existing Lib composition API; no compiler
//! implementation or language semantics are copied into the release product.
use std::{error::Error, fs, path::{Path, PathBuf}};
use serde_json::{json,Value};
use wasmc::lib_tool_rust_build_host::{LibToolCoreCompositionInput,LibToolCoreModuleInput,LibToolRustBuildHost,LibToolRustBuildHostConfig,core_target_profile::LibToolCoreOptimizationProfile};
use wasmc::lib_tool_workspace_host::{LibToolApiImplementation,LibToolApiOrigin,LibToolApiRow,LibToolApiSupport,LibToolPackageInput,LibToolSkillMetadata};
fn text<'a>(v:&'a Value,k:&str)->Result<&'a str,Box<dyn Error>> {v[k].as_str().ok_or_else(||format!("missing string {k}").into())}
fn module(v:&Value)->Result<LibToolCoreModuleInput,Box<dyn Error>> {Ok(LibToolCoreModuleInput{module:text(v,"module")?.into(),artifact:PathBuf::from(text(v,"artifact")?),sha256:text(v,"sha256")?.into()})}
fn main()->Result<(),Box<dyn Error>> {
 let a:Vec<_>=std::env::args().collect();if a.len()!=8||a[1]!="lib"||a[2]!="build"||a[3]!="--workspace"||a[5]!="--publication" {return Err("usage: portable-producer lib build --workspace WORK --publication OUT SPEC".into());}
 let spec=Path::new(&a[7]); let doc:Value=serde_json::from_slice(&fs::read(spec)?)?;
 if text(&doc,"schema")?!="wasmc.lib-build/v0"||text(&doc,"wit")?!="lib.wit"||text(&doc["core"],"target_profile")?!="portable-v0" {return Err("unexpected input contract".into());}
 let skill=&doc["skill"];let skill=LibToolSkillMetadata{name:text(skill,"name")?.into(),version:text(skill,"version")?.into(),description:text(skill,"description")?.into()};
 let mut rows=Vec::new();for row in doc["apis"].as_array().ok_or("missing api rows")? {
  let origin=match text(row,"origin")?{"exact"=>LibToolApiOrigin::Exact,"adapted"=>LibToolApiOrigin::Adapted,"wasmc-specific"=>LibToolApiOrigin::WasmcSpecific,_=>return Err("unknown origin".into())};
  let support=match text(row,"support")?{"supported"=>LibToolApiSupport::Supported,"unsupported"=>LibToolApiSupport::Unsupported,_=>return Err("unknown support".into())};
  let implementation=match text(row,"implementation")?{"core"=>LibToolApiImplementation::Core,"lib"=>LibToolApiImplementation::Lib,"host"=>LibToolApiImplementation::Host,_=>return Err("unknown implementation".into())};
  let authorities=row["host_authorities"].as_array().ok_or("missing authorities")?.iter().map(|x|x.as_str().map(str::to_owned).ok_or("invalid authority")).collect::<Result<Vec<_>,_>>()?;
  rows.push(LibToolApiRow{api:text(row,"api")?.into(),ecosystem:text(row,"ecosystem")?.into(),origin,support,implementation,delta:row["delta"].as_str().map(str::to_owned),host_authorities:authorities});
 }
 let core=&doc["core"];let dependencies=core["dependencies"].as_array().ok_or("missing dependencies")?.iter().map(module).collect::<Result<Vec<_>,_>>()?;
 let wit=fs::read_to_string(spec.parent().ok_or("spec parent")?.join("lib.wit"))?;
 let input=LibToolCoreCompositionInput{package:LibToolPackageInput{skill,lib_wit:wit,rows},root:module(&core["root"])?,dependencies};
 let tool=wasmc::compile_with_wit(include_str!("../../examples/wasmc_lib_tool_v0_document.wasmc"),include_str!("../../docs/wasmc-lib-tool-v0-document.wit"))?;
 let mut cfg=LibToolRustBuildHostConfig::new(PathBuf::from(&a[4]),PathBuf::from(&a[6]));
 cfg.core_optimization_profile=LibToolCoreOptimizationProfile::PortableV0;
 let report=LibToolRustBuildHost::new(&tool,cfg)?.compose_and_publish(&input)?;
 println!("{}",json!({"accepted":true,"schema":"wasmc.portable-lib-api-composition/v1","manifest_sha256":report.manifest_sha256,"artifact_sha256":report.artifact_sha256,"component_sha256":report.component_sha256}));
 Ok(())
}
