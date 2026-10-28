use std::collections::HashSet;
use wasmi::{Engine,Store,Linker,Module,Func,Caller,Val};
#[derive(Default)] struct State {roots:HashSet<i64>,created:usize,released:usize,moved:usize,seen:usize,fail_at:usize,fail_op:Option<&'static str>}
#[test]
fn owned_list_literal_cleanup_and_failed_push_recovery() {
 let source = r#"package local:literal; interface api { record Pair { name:string } run:func()->u32 { let xs:list<Pair> = [{name:"a"},{name:"雪"}]; return xs.len(); } } world app {export api;}"#;
 let wasm=wasmc::compile_lib_auto(source).unwrap();let bytes=std::fs::read(std::env::var("WASMC_AGGREGATE_INIT_PROVIDER").unwrap()).unwrap();
 assert_eq!(wasmc::self_bundle::hex(&wasmc::self_bundle::sha256(&bytes)),"c3ac42b93f4c27e24065abe804b91f54761eff782e2971e947847b3d20ee7e00");
 let e=Engine::default();let p=Module::new(&e,bytes.as_slice()).unwrap();let m=Module::new(&e,wasm.as_slice()).unwrap();let mut s=Store::new(&e,State::default());let heap=Linker::new(&e).instantiate_and_start(&mut s,&p).unwrap();assert_eq!(heap.get_typed_func::<(i32,u32),i32>(&s,"provider_domain_init").unwrap().call(&mut s,(127,37)).unwrap(),0);
 let mut l=Linker::new(&e);for import in m.imports(){let name=import.name().to_owned();let real=heap.get_func(&s,&name).unwrap();let ty=real.ty(&s);let wrap=Func::new(&mut s,ty,move |mut c:Caller<'_,State>,args,out|{
  if c.data().fail_op == Some(name.as_str()) {let data=c.data_mut();data.seen+=1;if data.fail_at==data.seen {out[0]=Val::I32(1);return Ok(());}}
  real.call(&mut c,args,out)?;
  if matches!(name.as_str(),"object_new"|"list_new"|"string_builder_new"|"string_clone") {let h=out[0].i64().unwrap(); if h<0 {let d=c.data_mut();assert!(d.roots.insert(h),"duplicate root {name}");d.created+=1;}}
  if name=="object_set_child_move" && out[0].i32().unwrap()==0 {let d=c.data_mut();assert!(d.roots.remove(&args[3].i64().unwrap()),"unknown record child move");d.moved+=1;}
  if name=="list_push_move" && out[0].i32().unwrap()==0 {let d=c.data_mut();assert!(d.roots.remove(&args[1].i64().unwrap()),"unknown list child move");d.moved+=1;}
  if matches!(name.as_str(),"object_drop"|"list_drop"|"string_drop") && out[0].i32().unwrap()==0 {let d=c.data_mut();assert!(d.roots.remove(&args[0].i64().unwrap()),"unknown root release {name}");d.released+=1;}
  Ok(())});l.define(import.module(),import.name(),wrap).unwrap();}
 let app=l.instantiate_and_start(&mut s,&m).unwrap();if let Ok(init)=app.get_typed_func::<(),i32>(&s,"__wasmc_managed_init"){assert_eq!(init.call(&mut s,()).unwrap(),0);}let f=app.get_typed_func::<(),u32>(&s,"run").unwrap();
 for _ in 0..32 {for (operation,failure) in [(None,0),(Some("list_push_move"),1),(Some("list_push_move"),2),(Some("object_set_child_move"),1),(Some("object_set_child_move"),2),(Some("string_builder_push_u64_le"),1),(Some("string_builder_push_u64_le"),2)] {s.data_mut().seen=0;s.data_mut().fail_at=failure;s.data_mut().fail_op=operation;let actual=f.call(&mut s,());if failure==0 {assert_eq!(actual.unwrap(),2);}else{assert!(actual.is_err(),"fault {operation:?} {failure} must trap");}assert!(s.data().roots.is_empty(),"live roots after fault {operation:?} {failure}: {:?}",s.data().roots);assert_eq!(s.data().created,s.data().released+s.data().moved);if failure!=0 {s.data_mut().seen=0;s.data_mut().fail_at=0;s.data_mut().fail_op=None;assert_eq!(f.call(&mut s,()).unwrap(),2);assert!(s.data().roots.is_empty(),"recovery leaked roots");assert_eq!(s.data().created,s.data().released+s.data().moved);}}}
 eprintln!("WASMI_LIST_OWNER_ROOT_LEDGER created={} released={} moved={} remaining={} fault_calls=192",s.data().created,s.data().released,s.data().moved,s.data().roots.len());
}
