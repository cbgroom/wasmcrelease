use wasmtime::{Engine,Store,component::{Component,Linker}};
wasmtime::component::bindgen!({path:"csv-root/lib.wit",world:"csv"});
use wasmc::data_core::types::{Column,DataType,Field};
use exports::wasmc::csv::parser::CsvOptions;
fn main()->Result<(),Box<dyn std::error::Error>>{
 let engine=Engine::default();let c=Component::from_file(&engine,std::env::args().nth(1).unwrap())?;let mut s=Store::new(&engine,());let b=Csv::instantiate(&mut s,&c,&Linker::<()>::new(&engine))?;let p=b.wasmc_csv_parser();
 let options=||CsvOptions{has_header:false,validate_header:false,delimiter:b',',batch_rows:1};
 let fields=|t|[Field{name:"value".into(),data_type:t,nullable:false}];
 for n in [8,1_048_577,16_777_216,16_777_217,17_825_793,11] {
  let mut input=vec![b'x';n];input.push(b'\n');let mut batches=p.call_parse(&mut s,&input,&fields(DataType::Utf8),options())?.map_err(|e|format!("parse error {e:?}"))?;
  assert_eq!(batches.len(),1);let mut batch=batches.pop().unwrap();assert_eq!(batch.rows,1);assert_eq!(batch.columns.len(),1);
  let strings=match batch.columns.pop().unwrap(){Column::Utf8Column(v)=>v,_=>return Err("unexpected column".into())};assert_eq!(strings.len(),1);let text=strings[0].as_ref().ok_or("null value")?;assert_eq!(text.len(),n);assert!(text.bytes().all(|x|x==b'x'));println!("field_bytes={n} output_equal=true");
 }
 let bad=p.call_parse(&mut s,b"not-an-integer\n",&fields(DataType::Int64),options())?;assert!(bad.is_err());
 let good=p.call_parse(&mut s,b"42\n",&fields(DataType::Int64),options())?.map_err(|e|format!("recovery {e:?}"))?;assert_eq!(good.len(),1);match &good[0].columns[0]{Column::Int64Column(v)=>assert_eq!(v.as_slice(),&[Some(42)]),_=>return Err("wrong int output".into())};println!("invalid_then_same_instance_recovery=true");
 let mut limited=Store::new(&engine,wasmtime::StoreLimitsBuilder::new().memory_size(4*1024*1024).build());limited.limiter(|state|state);
 let limited_bindings=Csv::instantiate(&mut limited,&c,&Linker::<wasmtime::StoreLimits>::new(&engine))?;let lp=limited_bindings.wasmc_csv_parser();
 let mut over=vec![b'x';16_777_216];over.push(b'\n');let denied=lp.call_parse(&mut limited,&over,&fields(DataType::Utf8),options());assert!(denied.is_err(),"overall Store memory limit must reject");println!("limited_store_16m_rejected=true");
 let again=lp.call_parse(&mut limited,b"ok\n",&fields(DataType::Utf8),options());assert!(again.is_err(),"component unexpectedly reentered after trap");println!("limited_trapped_instance_not_reusable=true");
 drop(limited);let mut recovered=Store::new(&engine,wasmtime::StoreLimitsBuilder::new().memory_size(4*1024*1024).build());recovered.limiter(|state|state);let rebound=Csv::instantiate(&mut recovered,&c,&Linker::<wasmtime::StoreLimits>::new(&engine))?;
 let fresh=rebound.wasmc_csv_parser().call_parse(&mut recovered,b"ok\n",&fields(DataType::Utf8),options())?.map_err(|e|format!("new store recovery {e:?}"))?;assert_eq!(fresh.len(),1);match &fresh[0].columns[0]{Column::Utf8Column(v)=>assert_eq!(v[0].as_deref(),Some("ok")),_=>return Err("wrong new store recovery".into())};println!("fresh_limited_store_recovery=true");Ok(())
}
