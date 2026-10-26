use wasmc_data_compute_core::wasmc::data_compute::compute::project;
use wasmc_data_compute_core::wasmc::data_core::types::{Field,DataType,Column,BatchSnapshot};
#[no_mangle]
pub extern "C" fn run(length:u32,seed:u32)->u32 {
 let c=if seed==0 {'a'} else {'b'};
 let batch=BatchSnapshot{rows:1,fields:vec![Field{name:"value".into(),data_type:DataType::Utf8,nullable:false}],columns:vec![Column::Utf8Column(vec![Some(c.to_string().repeat(length as usize))])]};
 let result=project(&batch,&[0]).unwrap(); assert_eq!(result.rows,1);
 match &result.columns[0] {Column::Utf8Column(values)=>{let s=values[0].as_ref().unwrap();assert_eq!(s.len(),length as usize);assert!(s.bytes().all(|v|v==c as u8));},_=>panic!("unexpected column")};length
}
