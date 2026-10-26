use wasmc_data_profile_core::wasmc::data_profile::profile::{describe,Summary};
use wasmc_data_profile_core::wasmc::data_core::types::{Field,DataType,Column,BatchSnapshot};
#[no_mangle]
pub extern "C" fn run(length:u32,seed:u32)->u32 {
 let byte=if seed==0 {'a'} else {'b'};let value=byte.to_string().repeat(length as usize);let batch=BatchSnapshot{rows:1,fields:vec![Field{name:"value".into(),data_type:DataType::Utf8,nullable:false}],columns:vec![Column::Utf8Column(vec![Some(value)])]};let result=describe(&batch,&[0]).unwrap();assert_eq!(result.len(),1);match result[0].summary {Summary::Utf8(x)=>{assert_eq!(x.non_null,1);assert_eq!(x.min_length,Some(length));assert_eq!(x.max_length,Some(length));},_=>panic!("unexpected summary")};length
}
