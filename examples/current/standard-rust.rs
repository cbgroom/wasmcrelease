#![no_std]
extern crate wasmc_std_core as stdlib;
use stdlib::{bytes,list,string};
#[panic_handler] fn panic(_: &core::panic::PanicInfo<'_>)->!{core::arch::wasm32::unreachable()}
#[unsafe(no_mangle)] pub extern "C" fn run(index:u32,item:u32)->i32{
 let value=bytes::new();for b in [0,1,1,255]{bytes::push(&value,b);}
 let needle=bytes::new();bytes::push(&needle,item as u8);
 let found=bytes::contains(&value,&needle);let count=bytes::count_byte(&value,item as u8);
 let text=string::new();let suffix=string::new();let ends=string::ends_with(&text,&suffix);
 let xs=list::new_s32();for v in [-7,0,i32::MAX]{list::push_s32(&xs,v);}
 let received=list::get_s32(&xs,index).unwrap_or(9);let n=list::len_s32(&xs);
 for i in 0..n{if list::get_s32(&xs,i).unwrap_or(65535)==65535{return 65535;}}
 if n!=3||!ends||item==1&&count!=2||(item==0||item==255)&&count!=1||item==128&&count!=0||found!=(count!=0){return 65535;}
 received
}
