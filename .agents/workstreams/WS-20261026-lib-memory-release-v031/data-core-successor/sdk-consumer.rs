use wasmc_data_core_core::wasmc::data_core::model::{take,validate};
use wasmc_data_core_core::wasmc::data_core::types::{Field,DataType,Column,BatchSnapshot};
#[no_mangle]
pub extern "C" fn run(length:u32,seed:u32)->u32 {
 let c=if seed==0 {'a'} else {'b'};let batch=BatchSnapshot{rows:1,fields:vec![Field{name:"value".into(),data_type:DataType::Utf8,nullable:false}],columns:vec![Column::Utf8Column(vec![Some(c.to_string().repeat(length as usize))])]};
 assert_eq!(validate(&batch).unwrap(),1);let result=take(&batch,&[0]).unwrap();match &result.columns[0] {Column::Utf8Column(values)=>{let s=values[0].as_ref().unwrap();assert_eq!(s.len(),length as usize);assert!(s.bytes().all(|v|v==c as u8));},_=>panic!("unexpected column")};length
}
#[no_mangle]
pub extern "C" fn run_rows(length:u32)->u32 {
 let batch=BatchSnapshot{rows:length,fields:vec![Field{name:"v".into(),data_type:DataType::Uint64,nullable:false}],columns:vec![Column::Uint64Column((0..length).map(|i|Some(i as u64)).collect())]};
 assert_eq!(validate(&batch).unwrap(),length);let result=take(&batch,&[0,length-1]).unwrap();match &result.columns[0] {Column::Uint64Column(values)=>assert_eq!(values,&vec![Some(0),Some((length-1) as u64)]),_=>panic!("unexpected column")};length
}
