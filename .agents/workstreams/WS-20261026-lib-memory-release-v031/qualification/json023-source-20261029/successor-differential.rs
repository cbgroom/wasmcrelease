#[path = "/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/json-v031-overlay-private-qualified-20261029/proof/json-q0/source/libspec/wasmc-json/delta.rs"] mod old;
#[path = "/Users/youxianshi/code/.worktrees/wasmcrelease/WS-20261026-lib-memory-release-v031/libspec/wasmc-json/delta.rs"] mod new;
fn rng(x:&mut u64)->u64{*x=x.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);*x}
fn make(x:&mut u64,depth:usize)->String{
 let atoms=["null","true","false","-12","5e-3","0","\"雪🦀\"","\"x\\\"y\\\\z\"","\"\\u0000\"","18446744073709551615"];
 if depth==0{return atoms[(rng(x) as usize)%atoms.len()].to_string()}
 match rng(x)%4 {
  0=>atoms[(rng(x) as usize)%atoms.len()].to_string(),
  1=>format!("[ {}, {}, {} ]",make(x,depth-1),make(x,depth-1),make(x,depth-1)),
  _=>format!("{{\"a\":{},\"b\":{},\"a\":{}}}",make(x,depth-1),make(x,depth-1),make(x,depth-1)),
 }
}
fn check(bytes:&[u8]){
 assert_eq!(format!("{:?}",old::validate(bytes)),format!("{:?}",new::validate(bytes)),"validate {:?}",String::from_utf8_lossy(bytes));
 assert_eq!(format!("{:?}",old::compact(bytes)),format!("{:?}",new::compact(bytes)),"compact {:?}",String::from_utf8_lossy(bytes));
 let old_edits=vec![old::Edit{kind:old::EditKind::Set,path:"/a".into(),value_json:"[1,{\"v\":true}]".into()},old::Edit{kind:old::EditKind::Remove,path:"/a/0".into(),value_json:String::new()}];
 let new_edits=vec![new::Edit{kind:new::EditKind::Set,path:"/a".into(),value_json:"[1,{\"v\":true}]".into()},new::Edit{kind:new::EditKind::Remove,path:"/a/0".into(),value_json:String::new()}];
 assert_eq!(format!("{:?}",old::edit(bytes,old_edits)),format!("{:?}",new::edit(bytes,new_edits)),"edits {:?}",String::from_utf8_lossy(bytes));
 let paths=vec!["".into(),"/a".into(),"/a/0".into(),"/a/~1".into(),"/0".into(),"/~2".into()];
 assert_eq!(format!("{:?}",old::select(bytes,&paths)),format!("{:?}",new::select(bytes,&paths)),"select {:?}",String::from_utf8_lossy(bytes));
}
fn main(){let mut x=0x987654321u64;let mut n=0;for _ in 0..2500{let value=make(&mut x,4);check(value.as_bytes());n+=1;
 let mut broken=value.into_bytes();if !broken.is_empty(){let ix=(rng(&mut x) as usize)%broken.len();broken[ix]=b'!';check(&broken);n+=1;}}
 for s in ["{\"a\":1e400,\"a\":null}","[1e400]","\"\\ud800\"","{\"a\":[{}],\"a\":{\"x\":1}}","true false","[1,]"]{check(s.as_bytes());n+=1;}
 println!("differential_cases={n} operations=validate,compact,select,edit status=PASS");}
