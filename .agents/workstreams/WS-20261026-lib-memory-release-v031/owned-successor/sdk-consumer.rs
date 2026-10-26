use wasmc_owned_algorithms_core::wasmc::owned_algorithms::algorithms::{sum_s32,request_score,Request};
#[no_mangle]
pub extern "C" fn run_list(length:u32,seed:u32)->u32 {let x=if seed==0 {2} else {-3};let values=vec![x;length as usize];assert_eq!(sum_s32(&values),(length as i64)*(x as i64));length}
#[no_mangle]
pub extern "C" fn run_text(length:u32,seed:u32)->u32 {let ch=if seed==0 {'a'} else {'b'};let request=Request{label:ch.to_string().repeat(length as usize),values:vec![1,-3,4],enabled:true};assert_eq!(request_score(&request),(length as i64)*1000+102);length}
