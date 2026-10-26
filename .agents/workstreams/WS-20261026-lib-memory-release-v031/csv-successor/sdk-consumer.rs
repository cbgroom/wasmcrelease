use wasmc_csv_core::wasmc::csv::parser::{parse,CsvOptions};
use wasmc_csv_core::wasmc::data_core::types::{Field,DataType,Column};
#[no_mangle]
pub extern "C" fn run(length:u32,seed:u32)->u32 {
    let expected=if seed==0 {b'a'} else {b'b'};let mut input=vec![expected;length as usize];input.push(b'\n');
    let fields=[Field{name:"value".into(),data_type:DataType::Utf8,nullable:false}];
    let result=parse(&input,&fields,CsvOptions{has_header:false,validate_header:false,delimiter:b',',batch_rows:1}).unwrap();
    assert_eq!(result.len(),1);assert_eq!(result[0].rows,1);assert_eq!(result[0].columns.len(),1);
    match &result[0].columns[0]{Column::Utf8Column(values)=>{assert_eq!(values.len(),1);let value=values[0].as_ref().unwrap();assert_eq!(value.len(),length as usize);assert!(value.bytes().all(|b|b==expected));},_=>panic!("unexpected CSV output")};
    length
}
