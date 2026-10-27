use std::{fs,path::Path};
use sha2::{Sha256,Digest};
const SOURCE:&str=include_str!("source.wasmc");
fn hash(b:&[u8])->String{Sha256::digest(b).iter().map(|x|format!("{x:02x}")).collect()}
#[derive(Default)]
struct State {mode:u32,case:u32,handle:i32,body:Vec<u8>,path:Vec<u8>,reply_live:bool,error_live:bool,
 invokes:u32,lengths:u32,retires:u32,drops:u32,responses:Vec<(i32,Vec<u8>)>}
macro_rules! exercise_engine {
 ($backend:ident,$bytes:expr,$dir:expr,$name:expr,$rounds:expr,$instantiate:ident)=>{{
 use $backend::{Engine,Module,Store,Linker,Caller,Val,Extern};
 let engine=Engine::default();let module=Module::new(&engine,&$bytes[..]).unwrap();let mut linker=Linker::new(&engine);
 let mut defined=std::collections::BTreeSet::new();
 for import in module.imports() {
  if !defined.insert((import.module().to_owned(),import.name().to_owned())){continue;}
  let  $backend::ExternType::Func(ty)=import.ty() else{panic!("unexpected non-function import")};let name=import.name().to_owned();
  linker.func_new(import.module(),import.name(),ty.clone(),move|mut c:Caller<'_,State>,p:&[Val],r:&mut[Val]| {
   let memory=match c.get_export("memory"){Some(Extern::Memory(m))=>m,_=>panic!("Host memory missing")};
   let u=|i:usize|p[i].i32().unwrap() as u32;let get=|c:&Caller<'_,State>,at:u32,n:u32|{let mut b=vec![0;n as usize];memory.read(c,at as usize,&mut b).unwrap();b};
   let mut pair=None;let mut status=0;
   if let Some(field)=name.strip_prefix("request-").and_then(|s|s.strip_suffix("-len").or_else(||s.strip_suffix("-read"))) {
    let b=match field {"method"=>b"POST".to_vec(),"path"=>c.data().path.clone(),"body"=>c.data().body.clone(),"parameters"|"query"|"headers"=>vec![0;8],_=>panic!("field {field}")};
    if name.ends_with("-len") {status=b.len() as i32;}else{assert_eq!(u(0),0);assert_eq!(u(2) as usize,b.len());memory.write(&mut c,u(1) as usize,&b).unwrap();status=b.len() as i32;}
   } else if name=="response-canonical-write" {
    let body=get(&c,u(1),u(2));c.data_mut().responses.push((p[0].i32().unwrap(),body));
   } else if name=="wit-service-invoke" {
    assert_eq!(get(&c,u(0),u(1)),c.data().path);let body=get(&c,u(2),u(3));
    let expected=serde_json::to_vec(&serde_json::from_slice::<serde_json::Value>(&c.data().body).unwrap_or(serde_json::json!({}))).unwrap();assert_eq!(body,expected);
    c.data_mut().invokes+=1;assert!(!c.data().reply_live&&!c.data().error_live);
    if c.data().mode==1||(6..=15).contains(&c.data().mode) {c.data_mut().error_live=true;pair=Some((if c.data().mode==13 {1}else{0},31));}
    else {c.data_mut().reply_live=true;pair=Some((c.data().handle,0));}
   } else if name=="wit-table-response-len" {
    assert_eq!(p[0].i32(),Some(c.data().handle));c.data_mut().lengths+=1;
    if !c.data().reply_live&&c.data().mode==20 {pair=Some((0,0));}
    else if !c.data().reply_live||c.data().mode==2 {c.data_mut().error_live=true;pair=Some((0,31));}
    else {pair=Some((-1,0));}
   } else if name=="wit-table-response-drop" {
    assert_eq!(p[0].i32(),Some(c.data().handle));assert!(c.data().reply_live);c.data_mut().reply_live=false;c.data_mut().retires+=1;
    if c.data().mode==3 {c.data_mut().error_live=true;pair=Some((0,31));}
    else if c.data().mode==4 {pair=Some((1,0));}else{pair=Some((0,0));}
   } else if name=="error-case" {assert_eq!(u(0),31);assert!(c.data().error_live);status=if (16..=19).contains(&c.data().mode) {(c.data().mode-15) as i32}else if c.data().mode==6 {5}else if c.data().mode==14 {-1}else if c.data().mode==0 {0}else{c.data().case as i32};}
   else if name=="error-message-len" {assert_eq!(u(0),31);assert!(c.data().error_live);status=match c.data().mode {7=>65537,15=>-1,10=>1,11=>0,12=>65536,_=>"拒绝🦀".len() as i32};}
   else if name=="error-message-read" {assert_eq!(u(0),31);assert!(c.data().error_live);let b=match c.data().mode {10=>vec![0xff],11=>vec![],12=>vec![b'x';65536],_=>"拒绝🦀".as_bytes().to_vec()};assert_eq!(u(2) as usize,b.len());memory.write(&mut c,u(1) as usize,&b).unwrap();if c.data().mode==8 {status=1;}}
   else if name=="error-drop" {assert_eq!(u(0),31);assert!(c.data().error_live);c.data_mut().error_live=false;c.data_mut().drops+=1;if c.data().mode==9 {status=1;}}
   else {panic!("unexpected Host import {name}");}
   if let Some((value,error))=pair {r[0]=Val::I32(value);r[1]=Val::I32(error);}else{r[0]=Val::I32(status);}Ok(())
  }).unwrap();
 }
 let mut store=Store::new(&engine,State::default());let instance=linker.$instantiate(&mut store,&module).unwrap();let run=instance.get_typed_func::<(),i32>(&mut store,"handle").unwrap();
 let pending=["__wasmc_app_input_pending","__wasmc_host_window_pending","__wasmc_value_pending_allocations"].map(|n|instance.get_typed_func::<(),i32>(&mut store,n).unwrap());
 let mut rows=Vec::new();
 for round in 0..$rounds {for selected_mode in [0,1,2,3,4,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20] {for case in 0..5 {for mode in [selected_mode,0] {
  store.data_mut().mode=mode;store.data_mut().case=case;store.data_mut().handle=[0,1,-2147483647,-1][round as usize%4];store.data_mut().body=format!("{{\"round\":{round},\"value\":\"雪🦀\"}}").into_bytes();store.data_mut().path=format!("route.雪\0{round}.{mode}.{case}").into_bytes();let before=store.data().invokes;
  let result=run.call(&mut store,());assert_eq!(store.data().invokes,before+1);assert!(!store.data().reply_live&&!store.data().error_live);
  for f in &pending {assert_eq!(f.call(&mut store,()).unwrap(),0);}
  if [4,6,7,8,9,10,13,14,15].contains(&mode) {assert!(result.is_err()||result.unwrap()!=0);}else{assert_eq!(result.unwrap(),0);assert_eq!(store.data().responses.last().unwrap(),&(if (16..=20).contains(&mode){597}else if mode==0{201}else if mode==1||mode>=6{503}else{502},store.data().body.clone()));}
  rows.push(serde_json::json!({"round":round,"mode":mode,"case":case,"pending":0}));
 }}}}
 fs::write($dir.join(format!("qualification-{}.json",$name)),serde_json::to_vec_pretty(&serde_json::json!({"accepted":true,"engine":$name,"source_sha256":hash(SOURCE.as_bytes()),"artifact_sha256":hash($bytes),"calls":rows.len(),"service_calls":store.data().invokes,"response_drops":store.data().retires,"owned_error_drops":store.data().drops,"same_instance":true,"pending_counters_zero":3,"Host_effects":"in-memory conformance callbacks only","rows":rows})).unwrap()).unwrap();
 }};
}
fn main(){let dir=Path::new(".");let bytes=fs::read("native-26596/sealed/app.wasm").unwrap();assert_eq!(hash(&bytes),"b93b9ff23ad67855b018d253a158ef63d94034d32ef3306b85d54fb897f5dec6");exercise_engine!(wasmi,&bytes,dir,"Wasmi2",4,instantiate_and_start);}
