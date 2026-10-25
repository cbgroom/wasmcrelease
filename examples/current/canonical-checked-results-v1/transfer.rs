
#[allow(dead_code,unused_variables)]
mod __wasmc_canonical_transfer {
use std::alloc::{Layout,alloc_zeroed,dealloc};
#[link(wasm_import_module="wasmc:private/canonical-memory@1")]
extern "C" {
 fn read8(p:i32)->i32;fn read32(p:i32)->i32;fn read64(p:i32)->i64;
 fn write8(p:i32,v:i32);fn write32(p:i32,v:i32);fn write64(p:i32,v:i64);
 fn own_read8(p:i32)->i32;fn own_read32(p:i32)->i32;fn own_read64(p:i32)->i64;
 fn own_write8(p:i32,v:i32);fn own_write32(p:i32,v:i32);fn own_write64(p:i32,v:i64);
 fn own_memory_size()->i32;fn lib_memory_size()->i32;
 fn copy_to_lib(d:i32,s:i32,n:i32);fn copy_from_lib(d:i32,s:i32,n:i32);
}
struct Budget{bytes:u32,nodes:u32,depth:u32}
impl Budget{fn new()->Self{Self{bytes:16*1024*1024,nodes:1024*1024,depth:0}}fn charge(&mut self,n:u32){self.bytes=self.bytes.checked_sub(n).expect("transfer byte budget");}fn elements(&mut self,n:u32){self.nodes=self.nodes.checked_sub(n).expect("transfer node budget");}fn enter(&mut self){self.elements(1);self.depth+=1;assert!(self.depth<=32);}fn leave(&mut self){self.depth-=1;}}
fn add(p:u32,n:u32)->u32{p.checked_add(n).expect("pointer overflow")}
fn range(lib:bool,p:u32,n:u32,a:u32){assert!(a.is_power_of_two()&&p%a==0);let pages=unsafe{if lib{lib_memory_size()}else{own_memory_size()}} as u32 as u64;assert!((p as u64)+(n as u64)<=pages*65536);}
fn r(lib:bool,p:u32,n:u32)->u64{range(lib,p,n,1);unsafe{match n{1=>if lib{read8(p as i32) as u32 as u64}else{own_read8(p as i32) as u32 as u64},2=>r(lib,p,1)|(r(lib,add(p,1),1)<<8),4=>if lib{read32(p as i32) as u32 as u64}else{own_read32(p as i32) as u32 as u64},8=>if lib{read64(p as i32) as u64}else{own_read64(p as i32) as u64},_=>panic!("read width")}}}
fn w(lib:bool,p:u32,x:u64,n:u32){range(lib,p,n,1);unsafe{match n{1=>if lib{write8(p as i32,x as i32)}else{own_write8(p as i32,x as i32)},2=>{w(lib,p,x,1);w(lib,add(p,1),x>>8,1)},4=>if lib{write32(p as i32,x as i32)}else{own_write32(p as i32,x as i32)},8=>if lib{write64(p as i32,x as i64)}else{own_write64(p as i32,x as i64)},_=>panic!("write width")}}}
fn zero(lib:bool,p:u32,n:u32){range(lib,p,n,1);for i in 0..n{w(lib,add(p,i),0,1);}}
fn blit(from:bool,to:bool,s:u32,d:u32,n:u32){range(from,s,n,1);range(to,d,n,1);if from==to{if s!=d{for i in 0..n{w(to,add(d,i),r(from,add(s,i),1),1);}}}else{unsafe{if from{copy_from_lib(d as i32,s as i32,n as i32)}else{copy_to_lib(d as i32,s as i32,n as i32)}}}}
fn allocate(lib:bool,n:u32,a:u32,b:&mut Budget)->u32{b.charge(n);if n==0{return a;}let p=if lib{unsafe{realloc(0,0,a as i32,n as i32) as u32}}else{let l=Layout::from_size_align(n as usize,a as usize).unwrap();let p=unsafe{alloc_zeroed(l)};assert!(!p.is_null());value_allocation(p as usize as u32,n,a);p as usize as u32};range(lib,p,n,a);if lib{zero(true,p,n);}p}
struct Scratch{p:u32,l:Layout}
impl Scratch{fn new(n:u32,a:u32,b:&mut Budget)->Self{let l=Layout::from_size_align(n.max(1) as usize,a as usize).unwrap();let p=allocate(false,n.max(1),a,b);Self{p,l}}}
impl Drop for Scratch{fn drop(&mut self){unsafe{value_scratch_drop(self.p);dealloc(self.p as usize as *mut u8,self.l);}}}

static mut VALUE_ACTIVE:Option<(u32,u32)>=None;
static mut VALUE_CAPTURE:bool=false;
static mut VALUE_ALLOCATIONS:Vec<(u32,u32,u32)>=Vec::new();
static mut VALUE_STAGING:Option<(u32,u32)>=None;
static mut VALUE_STAGE_BYTES:u32=2*1024*1024;
static mut VALUE_STAGE_NODES:u32=1024*1024;
fn value_allocation(p:u32,n:u32,a:u32){unsafe{if VALUE_CAPTURE{assert!(VALUE_ALLOCATIONS.len()<1024*1024);VALUE_ALLOCATIONS.push((p,n,a));}}}
fn value_scratch_drop(p:u32){unsafe{if VALUE_CAPTURE{let i=VALUE_ALLOCATIONS.iter().position(|x|x.0==p).expect("scratch allocation lease");VALUE_ALLOCATIONS.swap_remove(i);}}}
fn value_begin(i:u32,d:u32){unsafe{assert!(VALUE_ACTIVE.is_none()&&!VALUE_CAPTURE&&VALUE_ALLOCATIONS.is_empty());VALUE_ACTIVE=Some((i,d));VALUE_CAPTURE=true;}}
fn value_call_begin(i:u32,p:u32,d:u32){unsafe{if VALUE_ACTIVE.is_none(){value_begin(i,d);}else{assert!(VALUE_ACTIVE==Some((i,d))&&VALUE_CAPTURE&&VALUE_STAGING==Some((p,d)));VALUE_STAGING=None;}}}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_stage_allocate(n:u32,a:u32)->u32{assert!(VALUE_CAPTURE&&VALUE_STAGING.is_some()&&a.is_power_of_two()&&a<=8);VALUE_STAGE_BYTES=VALUE_STAGE_BYTES.checked_sub(n).expect("staging byte budget");VALUE_STAGE_NODES=VALUE_STAGE_NODES.checked_sub(1).expect("staging node budget");allocate(false,n,a,&mut Budget::new())}
fn value_open(i:u32,pn:u32,pa:u32,dn:u32,da:u32)->u64{unsafe{value_begin(i,0);VALUE_STAGE_BYTES=2*1024*1024;VALUE_STAGE_NODES=1024*1024;VALUE_STAGING=Some((0,0));let p=__wasmc_value_stage_allocate(pn,pa);let d=__wasmc_value_stage_allocate(dn,da);VALUE_ACTIVE=Some((i,d));VALUE_STAGING=Some((p,d));((d as u64)<<32)|(p as u64)}}
fn value_cancel(i:u32,d:u32){unsafe{assert!(VALUE_ACTIVE==Some((i,d))&&VALUE_CAPTURE&&VALUE_STAGING.is_some_and(|(_,q)|q==d));VALUE_STAGING=None;VALUE_CAPTURE=false;value_post(i,d);}}
fn value_ready(){unsafe{assert!(VALUE_CAPTURE);VALUE_CAPTURE=false;}}
fn value_post(i:u32,d:u32){unsafe{assert!(VALUE_ACTIVE==Some((i,d))&&!VALUE_CAPTURE&&VALUE_STAGING.is_none());VALUE_ACTIVE=None;let allocations=std::mem::take(&mut VALUE_ALLOCATIONS);for(p,n,a)in allocations{dealloc(p as usize as *mut u8,Layout::from_size_align(n as usize,a as usize).unwrap());}}}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_pending_allocations()->u32{VALUE_ALLOCATIONS.len() as u32}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")] extern "C" {#[link_name="cabi_realloc"]fn realloc(p:i32,n:i32,a:i32,m:i32)->i32;}
fn c_bool(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,1,1);range(to,d,1,1);let x=r(from,s,1);assert!(x<=1);w(to,d,x,1);b.leave();}
fn c_u8(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,1,1);range(to,d,1,1);blit(from,to,s,d,1);b.leave();}
fn c_s8(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,1,1);range(to,d,1,1);blit(from,to,s,d,1);b.leave();}
fn c_u16(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,2,2);range(to,d,2,2);blit(from,to,s,d,2);b.leave();}
fn c_s16(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,2,2);range(to,d,2,2);blit(from,to,s,d,2);b.leave();}
fn c_u32(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,4,4);range(to,d,4,4);blit(from,to,s,d,4);b.leave();}
fn c_s32(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,4,4);range(to,d,4,4);blit(from,to,s,d,4);b.leave();}
fn c_u64(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,8,8);range(to,d,8,8);blit(from,to,s,d,8);b.leave();}
fn c_s64(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,8,8);range(to,d,8,8);blit(from,to,s,d,8);b.leave();}
fn c_f32(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,4,4);range(to,d,4,4);blit(from,to,s,d,4);b.leave();}
fn c_f64(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,8,8);range(to,d,8,8);blit(from,to,s,d,8);b.leave();}
fn c_char(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,4,4);range(to,d,4,4);let x=r(from,s,4);assert!(char::from_u32(x as u32).is_some());w(to,d,x,4);b.leave();}
fn c_string(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;range(from,p,n,1);b.charge(n);let mut v=Vec::with_capacity(n as usize);if from{if n!=0{unsafe{copy_from_lib(v.as_mut_ptr() as usize as i32,p as i32,n as i32);v.set_len(n as usize);}}}else{for i in 0..n{v.push(r(from,add(p,i),1) as u8);}}assert!(std::str::from_utf8(&v).is_ok());let q=allocate(!from,n,1,b);blit(from,!from,p,q,n);w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);b.leave();}
fn c0(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,1,1);range(to,d,1,1);let x=r(from,s,1);assert!(x<7);w(to,d,x,1);b.leave();}
fn c1(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,12,4);range(to,d,12,4);c_bool(add(s,0),add(d,0),from,to,b);c_string(add(s,4),add(d,4),from,to,b);b.leave();}
fn c2(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;assert!(n<=b.nodes);let bytes=n.checked_mul(12).expect("list size");range(from,p,bytes,4);let q=allocate(!from,bytes,4,b);for i in 0..n{c1(add(p,i*12),add(q,i*12),from,!from,b);}w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);b.leave();}
fn c3(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,2,1);range(to,d,2,1);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{},1=>{c0(add(s,1),add(d,1),from,to,b);},_=>unreachable!()};b.leave();}
fn c4(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,16,4);range(to,d,16,4);c_bool(add(s,0),add(d,0),from,to,b);c2(add(s,4),add(d,4),from,to,b);c3(add(s,12),add(d,12),from,to,b);b.leave();}
fn c5(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,12,4);range(to,d,12,4);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{c_string(add(s,4),add(d,4),from,to,b);},1=>{c0(add(s,4),add(d,4),from,to,b);},_=>unreachable!()};b.leave();}
fn c6(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;assert!(n<=b.nodes);let bytes=n.checked_mul(8).expect("list size");range(from,p,bytes,4);let q=allocate(!from,bytes,4,b);for i in 0..n{c_string(add(p,i*8),add(q,i*8),from,!from,b);}w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);b.leave();}
fn c7(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,12,4);range(to,d,12,4);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{},1=>{c_string(add(s,4),add(d,4),from,to,b);},_=>unreachable!()};b.leave();}
fn c8(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;assert!(n<=b.nodes);let bytes=n.checked_mul(12).expect("list size");range(from,p,bytes,4);let q=allocate(!from,bytes,4,b);for i in 0..n{c7(add(p,i*12),add(q,i*12),from,!from,b);}w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);b.leave();}
fn c9(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,12,4);range(to,d,12,4);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{c8(add(s,4),add(d,4),from,to,b);},1=>{c0(add(s,4),add(d,4),from,to,b);},_=>unreachable!()};b.leave();}
fn c10(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,2,1);range(to,d,2,1);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{},1=>{c0(add(s,1),add(d,1),from,to,b);},_=>unreachable!()};b.leave();}
fn c11(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;b.elements(n.checked_mul(1).expect("transfer node budget"));let bytes=n.checked_mul(1).expect("list size");range(from,p,bytes,1);let q=allocate(!from,bytes,1,b);blit(from,!from,p,q,bytes);w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);b.leave();}
fn c12(s:u32,d:u32,from:bool,to:bool,b:&mut Budget){b.enter();range(from,s,12,4);range(to,d,12,4);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{c2(add(s,4),add(d,4),from,to,b);},1=>{c0(add(s,4),add(d,4),from,to,b);},_=>unreachable!()};b.leave();}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#compact"]fn raw0(p0:i32,p1:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.0.7#compact"]fn post0(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_0(p0:i32,p1:i32,p2:i32){let mut b=Budget::new();let args=Scratch::new(8, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false,&mut b);let result=raw0(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,12,4);zero(false,dst,12);c5(result as u32,dst,true,false,&mut b);post0(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_0()->u64{value_open(0,8,4,12,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_0(d:u32){value_cancel(0,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_0(p:u32,d:u32){range(false,p,8,4);range(false,d,12,4);assert!(add(p,8)<=d||add(d,12)<=p);value_call_begin(0,p,d);let result=__wasmc_canonical_bridge_0(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_0(d:u32){value_post(0,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#select"]fn raw1(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.0.7#select"]fn post1(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_1(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let mut b=Budget::new();let args=Scratch::new(16, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false,&mut b);c6(add(args.p,8),add(args.p,8),false,false,&mut b);let result=raw1(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,12,4);zero(false,dst,12);c9(result as u32,dst,true,false,&mut b);post1(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_1()->u64{value_open(1,16,4,12,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_1(d:u32){value_cancel(1,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_1(p:u32,d:u32){range(false,p,16,4);range(false,d,12,4);assert!(add(p,16)<=d||add(d,12)<=p);value_call_begin(1,p,d);let result=__wasmc_canonical_bridge_1(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,r(false,add(p,8),4) as i32,r(false,add(add(p,8),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_1(d:u32){value_post(1,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#validate"]fn raw2(p0:i32,p1:i32)->i32;}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_2(p0:i32,p1:i32,p2:i32){let mut b=Budget::new();let args=Scratch::new(8, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false,&mut b);let result=raw2(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,2,1);zero(false,dst,2);c10(result as u32,dst,true,false,&mut b);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_2()->u64{value_open(2,8,4,2,1)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_2(d:u32){value_cancel(2,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_2(p:u32,d:u32){range(false,p,8,4);range(false,d,2,1);assert!(add(p,8)<=d||add(d,2)<=p);value_call_begin(2,p,d);let result=__wasmc_canonical_bridge_2(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_2(d:u32){value_post(2,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#compact-bytes"]fn raw3(p0:i32,p1:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.0.7#compact-bytes"]fn post3(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_3(p0:i32,p1:i32,p2:i32){let mut b=Budget::new();let args=Scratch::new(8, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c11(add(args.p,0),add(args.p,0),false,false,&mut b);let result=raw3(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,12,4);zero(false,dst,12);c5(result as u32,dst,true,false,&mut b);post3(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_3()->u64{value_open(3,8,4,12,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_3(d:u32){value_cancel(3,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_3(p:u32,d:u32){range(false,p,8,4);range(false,d,12,4);assert!(add(p,8)<=d||add(d,12)<=p);value_call_begin(3,p,d);let result=__wasmc_canonical_bridge_3(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_3(d:u32){value_post(3,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#select-bytes"]fn raw4(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.0.7#select-bytes"]fn post4(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_4(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let mut b=Budget::new();let args=Scratch::new(16, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c11(add(args.p,0),add(args.p,0),false,false,&mut b);c6(add(args.p,8),add(args.p,8),false,false,&mut b);let result=raw4(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,12,4);zero(false,dst,12);c9(result as u32,dst,true,false,&mut b);post4(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_4()->u64{value_open(4,16,4,12,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_4(d:u32){value_cancel(4,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_4(p:u32,d:u32){range(false,p,16,4);range(false,d,12,4);assert!(add(p,16)<=d||add(d,12)<=p);value_call_begin(4,p,d);let result=__wasmc_canonical_bridge_4(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,r(false,add(p,8),4) as i32,r(false,add(add(p,8),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_4(d:u32){value_post(4,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#validate-bytes"]fn raw5(p0:i32,p1:i32)->i32;}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_5(p0:i32,p1:i32,p2:i32){let mut b=Budget::new();let args=Scratch::new(8, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c11(add(args.p,0),add(args.p,0),false,false,&mut b);let result=raw5(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,2,1);zero(false,dst,2);c10(result as u32,dst,true,false,&mut b);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_5()->u64{value_open(5,8,4,2,1)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_5(d:u32){value_cancel(5,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_5(p:u32,d:u32){range(false,p,8,4);range(false,d,2,1);assert!(add(p,8)<=d||add(d,2)<=p);value_call_begin(5,p,d);let result=__wasmc_canonical_bridge_5(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_5(d:u32){value_post(5,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#select-values"]fn raw6(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.0.7#select-values"]fn post6(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_6(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let mut b=Budget::new();let args=Scratch::new(16, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false,&mut b);c6(add(args.p,8),add(args.p,8),false,false,&mut b);let result=raw6(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,12,4);zero(false,dst,12);c12(result as u32,dst,true,false,&mut b);post6(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_6()->u64{value_open(6,16,4,12,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_6(d:u32){value_cancel(6,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_6(p:u32,d:u32){range(false,p,16,4);range(false,d,12,4);assert!(add(p,16)<=d||add(d,12)<=p);value_call_begin(6,p,d);let result=__wasmc_canonical_bridge_6(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,r(false,add(p,8),4) as i32,r(false,add(add(p,8),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_6(d:u32){value_post(6,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#select-values-bytes"]fn raw7(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.0.7#select-values-bytes"]fn post7(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_7(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let mut b=Budget::new();let args=Scratch::new(16, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c11(add(args.p,0),add(args.p,0),false,false,&mut b);c6(add(args.p,8),add(args.p,8),false,false,&mut b);let result=raw7(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,12,4);zero(false,dst,12);c12(result as u32,dst,true,false,&mut b);post7(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_7()->u64{value_open(7,16,4,12,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_7(d:u32){value_cancel(7,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_7(p:u32,d:u32){range(false,p,16,4);range(false,d,12,4);assert!(add(p,16)<=d||add(d,12)<=p);value_call_begin(7,p,d);let result=__wasmc_canonical_bridge_7(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,r(false,add(p,8),4) as i32,r(false,add(add(p,8),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_7(d:u32){value_post(7,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#compact-or-bytes"]fn raw8(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.0.7#compact-or-bytes"]fn post8(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_8(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let mut b=Budget::new();let args=Scratch::new(16, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c11(add(args.p,0),add(args.p,0),false,false,&mut b);c_string(add(args.p,8),add(args.p,8),false,false,&mut b);let result=raw8(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false,&mut b);post8(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_8()->u64{value_open(8,16,4,8,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_8(d:u32){value_cancel(8,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_8(p:u32,d:u32){range(false,p,16,4);range(false,d,8,4);assert!(add(p,16)<=d||add(d,8)<=p);value_call_begin(8,p,d);let result=__wasmc_canonical_bridge_8(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,r(false,add(p,8),4) as i32,r(false,add(add(p,8),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_8(d:u32){value_post(8,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#select-string-or-bytes"]fn raw9(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32,p5:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.0.7#select-string-or-bytes"]fn post9(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_9(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32,p5:i32,p6:i32){let mut b=Budget::new();let args=Scratch::new(24, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);w(false,add(args.p,16),(p4) as u32 as u64,4);w(false,add(add(args.p,16),4),(p5) as u32 as u64,4);c11(add(args.p,0),add(args.p,0),false,false,&mut b);c_string(add(args.p,8),add(args.p,8),false,false,&mut b);c_string(add(args.p,16),add(args.p,16),false,false,&mut b);let result=raw9(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32,r(false,add(args.p,16),4) as i32,r(false,add(add(args.p,16),4),4) as i32);let dst=p6 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false,&mut b);post9(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_9()->u64{value_open(9,24,4,8,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_9(d:u32){value_cancel(9,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_9(p:u32,d:u32){range(false,p,24,4);range(false,d,8,4);assert!(add(p,24)<=d||add(d,8)<=p);value_call_begin(9,p,d);let result=__wasmc_canonical_bridge_9(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,r(false,add(p,8),4) as i32,r(false,add(add(p,8),4),4) as i32,r(false,add(p,16),4) as i32,r(false,add(add(p,16),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_9(d:u32){value_post(9,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#inspect-values-bytes"]fn raw10(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.0.7#inspect-values-bytes"]fn post10(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_10(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let mut b=Budget::new();let args=Scratch::new(16, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c11(add(args.p,0),add(args.p,0),false,false,&mut b);c6(add(args.p,8),add(args.p,8),false,false,&mut b);let result=raw10(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,16,4);zero(false,dst,16);c4(result as u32,dst,true,false,&mut b);post10(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_10()->u64{value_open(10,16,4,16,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_10(d:u32){value_cancel(10,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_10(p:u32,d:u32){range(false,p,16,4);range(false,d,16,4);assert!(add(p,16)<=d||add(d,16)<=p);value_call_begin(10,p,d);let result=__wasmc_canonical_bridge_10(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,r(false,add(p,8),4) as i32,r(false,add(add(p,8),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_10(d:u32){value_post(10,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#compact-or"]fn raw11(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.0.7#compact-or"]fn post11(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_11(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let mut b=Budget::new();let args=Scratch::new(16, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false,&mut b);c_string(add(args.p,8),add(args.p,8),false,false,&mut b);let result=raw11(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false,&mut b);post11(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_11()->u64{value_open(11,16,4,8,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_11(d:u32){value_cancel(11,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_11(p:u32,d:u32){range(false,p,16,4);range(false,d,8,4);assert!(add(p,16)<=d||add(d,8)<=p);value_call_begin(11,p,d);let result=__wasmc_canonical_bridge_11(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,r(false,add(p,8),4) as i32,r(false,add(add(p,8),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_11(d:u32){value_post(11,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/document@0.0.7#decode-string-or"]fn raw12(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.0.7#decode-string-or"]fn post12(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_12(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let mut b=Budget::new();let args=Scratch::new(16, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false,&mut b);c_string(add(args.p,8),add(args.p,8),false,false,&mut b);let result=raw12(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false,&mut b);post12(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_12()->u64{value_open(12,16,4,8,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_12(d:u32){value_cancel(12,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_12(p:u32,d:u32){range(false,p,16,4);range(false,d,8,4);assert!(add(p,16)<=d||add(d,8)<=p);value_call_begin(12,p,d);let result=__wasmc_canonical_bridge_12(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,r(false,add(p,8),4) as i32,r(false,add(add(p,8),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_12(d:u32){value_post(12,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/utf8@0.0.7#encode-parts-or"]fn raw13(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32)->i32;#[link_name="cabi_post_wasmc:json/utf8@0.0.7#encode-parts-or"]fn post13(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_13(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32,p5:i32){let mut b=Budget::new();let args=Scratch::new(20, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u64,4);w(false,add(args.p,12),(p3) as u32 as u64,4);w(false,add(add(args.p,12),4),(p4) as u32 as u64,4);c6(add(args.p,0),add(args.p,0),false,false,&mut b);c_u32(add(args.p,8),add(args.p,8),false,false,&mut b);c_string(add(args.p,12),add(args.p,12),false,false,&mut b);let result=raw13(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,(r(false,add(args.p,8),4) as i32),r(false,add(args.p,12),4) as i32,r(false,add(add(args.p,12),4),4) as i32);let dst=p5 as u32;range(false,dst,8,4);zero(false,dst,8);c11(result as u32,dst,true,false,&mut b);post13(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_13()->u64{value_open(13,20,4,8,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_13(d:u32){value_cancel(13,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_13(p:u32,d:u32){range(false,p,20,4);range(false,d,8,4);assert!(add(p,20)<=d||add(d,8)<=p);value_call_begin(13,p,d);let result=__wasmc_canonical_bridge_13(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,(r(false,add(p,8),4) as i32),r(false,add(p,12),4) as i32,r(false,add(add(p,12),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_13(d:u32){value_post(13,d);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.0.7")]extern "C"{#[link_name="wasmc:json/utf8@0.0.7#encode"]fn raw14(p0:i32,p1:i32)->i32;#[link_name="cabi_post_wasmc:json/utf8@0.0.7#encode"]fn post14(p:i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_canonical_bridge_14(p0:i32,p1:i32,p2:i32){let mut b=Budget::new();let args=Scratch::new(8, 4, &mut b);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false,&mut b);let result=raw14(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,8,4);zero(false,dst,8);c11(result as u32,dst,true,false,&mut b);post14(result as i32);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_open_14()->u64{value_open(14,8,4,8,4)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_cancel_14(d:u32){value_cancel(14,d);}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_call_14(p:u32,d:u32){range(false,p,8,4);range(false,d,8,4);assert!(add(p,8)<=d||add(d,8)<=p);value_call_begin(14,p,d);let result=__wasmc_canonical_bridge_14(r(false,add(p,0),4) as i32,r(false,add(add(p,0),4),4) as i32,d as i32);value_ready();}
#[no_mangle]pub unsafe extern "C" fn __wasmc_value_post_14(d:u32){value_post(14,d);}
}

#[export_name="allocate"] pub unsafe extern "C" fn __wasmc_native_value_allocate(n:u32,a:u32)->u32 { __wasmc_canonical_transfer::__wasmc_value_stage_allocate(n,a) }

mod __wasmc_app_input_scratch {
    use std::alloc::{alloc,dealloc,Layout};
    static mut BLOCKS:Vec<(u32,u32,u32)>=Vec::new();
    static mut BYTES:u32=0;
    #[no_mangle]pub unsafe extern "C" fn __wasmc_app_input_allocate(n:u32,a:u32)->u32 {
        assert!(n<=2*1024*1024&&a.is_power_of_two()&&a<=8);
        BYTES=BYTES.checked_add(n).expect("app input byte budget");assert!(BYTES<=2*1024*1024);
        let actual=n.max(1);let layout=Layout::from_size_align(actual as usize,a as usize).unwrap();
        let p=alloc(layout);assert!(!p.is_null());BLOCKS.push((p as u32,actual,a));p as u32
    }
    #[no_mangle]pub unsafe extern "C" fn __wasmc_app_input_release() {
        let blocks=std::mem::take(&mut BLOCKS);BYTES=0;
        for(p,n,a)in blocks{dealloc(p as usize as *mut u8,Layout::from_size_align(n as usize,a as usize).unwrap());}
    }
    #[no_mangle]pub unsafe extern "C" fn __wasmc_app_input_pending()->u32 {BLOCKS.len() as u32}
}

mod __wasmc_native_host_window {
    use std::ptr::{read_unaligned,write_unaligned,copy_nonoverlapping};
    const MAX:u32=2*1024*1024;
    enum K {Leaf,String,List(&'static S),Record(&'static [(u32,S)]),Sum(u32,u32,&'static [S])}
    struct S {n:u32,a:u32,k:K}
    static mut WINDOW:Vec<u64>=Vec::new();
    static mut LENGTH:u32=0;
    unsafe fn span(p:u32,n:u32)->Option<()> {
        let end=p.checked_add(n)? as u64;
        if end>(core::arch::wasm32::memory_size::<0>() as u64)*65536 {return None;}Some(())
    }
    unsafe fn word(p:u32)->Option<u32> {span(p,4)?;Some(read_unaligned(p as usize as *const u32))}
    unsafe fn tag(p:u32,n:u32)->Option<u32> {span(p,n)?;Some(match n {
        1=>*(p as usize as *const u8) as u32,
        2=>read_unaligned(p as usize as *const u16) as u32,
        4=>read_unaligned(p as usize as *const u32),_=>return None,
    })}
    struct A {base:*mut u8,pos:u32,nodes:u32}
    impl A {
        fn reserve(&mut self,n:u32,a:u32)->Option<u32> {
            if !a.is_power_of_two()||a>8{return None;}
            let p=self.pos.checked_add(a-1)?&!(a-1);self.pos=p.checked_add(n)?;
            if self.pos>MAX {return None;}Some(p)
        }
        unsafe fn copy(&self,d:u32,p:u32,n:u32)->Option<()> {
            span(p,n)?;if !self.base.is_null()&&n>0 {copy_nonoverlapping(p as usize as *const u8,self.base.add(d as usize),n as usize);}Some(())
        }
        unsafe fn put(&self,d:u32,v:u32) {if !self.base.is_null(){write_unaligned(self.base.add(d as usize) as *mut u32,v);}}
        fn pointer(&self,d:u32)->u32 {(self.base as usize as u32).wrapping_add(d)}
    }
    unsafe fn walk(s:&S,p:u32,d:u32,a:&mut A,depth:u32)->Option<()> {
        if depth>64{return None;}a.nodes=a.nodes.checked_add(1)?;if a.nodes>MAX{return None;}
        span(p,s.n)?;
        match &s.k {
            K::Leaf=>a.copy(d,p,s.n)?,
            K::String=>{
                let q=word(p)?;let n=word(p.checked_add(4)?)?;span(q,n)?;
                let t=a.reserve(n,1)?;a.copy(t,q,n)?;a.put(d,a.pointer(t));a.put(d+4,n);
            }
            K::List(e)=>{
                let q=word(p)?;let n=word(p.checked_add(4)?)?;
                let bytes=n.checked_mul(e.n)?;span(q,bytes)?;if n>MAX{return None;}
                let t=a.reserve(bytes,e.a)?;a.put(d,a.pointer(t));a.put(d+4,n);
                for i in 0..n {walk(e,q+i*e.n,t+i*e.n,a,depth+1)?;}
            }
            K::Record(fields)=>for (o,e) in *fields {walk(e,p.checked_add(*o)?,d.checked_add(*o)?,a,depth+1)?;},
            K::Sum(n,o,cases)=>{
                let which=tag(p,*n)? as usize;let e=cases.get(which)?;
                a.copy(d,p,*n)?;walk(e,p.checked_add(*o)?,d.checked_add(*o)?,a,depth+1)?;
            }
        }Some(())
    }
    unsafe fn open(s:&S,p:u32)->u64 {
        if !WINDOW.is_empty(){return 0;}
        let mut measured=A{base:core::ptr::null_mut(),pos:s.n,nodes:0};
        if walk(s,p,0,&mut measured,0).is_none(){return 0;}
        let n=measured.pos.max(1);
        let mut bytes=vec![0u64;((n+7)/8) as usize];let base=bytes.as_mut_ptr() as *mut u8;
        let mut copy=A{base,pos:s.n,nodes:0};
        if walk(s,p,0,&mut copy,0).is_none()||copy.pos!=measured.pos {return 0;}
        let ptr=base as usize as u32;WINDOW=bytes;LENGTH=n;
        (ptr as u64)|((n as u64)<<32)
    }
    unsafe fn result(n:u32,result_payload:u32,tag_size:u32,variant_payload:u32,cases:u32,case:i32,len:u32)->u64 {
        if !WINDOW.is_empty()||n>MAX||len>MAX-n||case< -1||case as u32>=cases&&case!=-1 {return 0;}
        let mut bytes=vec![0u64;((n+len+7)/8).max(1) as usize];let base=bytes.as_mut_ptr() as *mut u8;
        let ptr=base as usize as u32;let message=ptr+n;
        if case>=0 {
            *base=1;
            match tag_size {1=>*base.add(result_payload as usize)=case as u8,
                2=>write_unaligned(base.add(result_payload as usize) as *mut u16,case as u16),
                4=>write_unaligned(base.add(result_payload as usize) as *mut u32,case as u32),_=>return 0,}
            let payload=base.add((result_payload+variant_payload) as usize);
            write_unaligned(payload as *mut u32,message);write_unaligned(payload.add(4) as *mut u32,len);
        }else if len!=0 {return 0;}
        WINDOW=bytes;LENGTH=n+len;(ptr as u64)|((message as u64)<<32)
    }
    #[no_mangle] pub unsafe extern "C" fn __wasmc_host_window_release() {drop(std::mem::take(&mut WINDOW));LENGTH=0;}
    #[no_mangle] pub unsafe extern "C" fn __wasmc_host_window_pending()->u32 {if WINDOW.is_empty(){0}else{1}}

#[no_mangle]pub unsafe extern "C" fn __wasmc_host_window_12(p0:u32)->u64 {let mut args=[0u64;1];let base=args.as_mut_ptr() as *mut u8;write_unaligned(base.add(0) as *mut u32,p0);open(&S{n:4,a:4,k:K::Record(&[(0,S{n:4,a:4,k:K::Leaf})])},base as usize as u32)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_host_make_result_12(case:i32,len:u32,value:u32)->u64 {let p=result(16,4,1,4,5,case,len);if p!=0&&case==-1{write_unaligned((p as u32+4) as usize as *mut u32,value);}p}

#[no_mangle]pub unsafe extern "C" fn __wasmc_host_window_14(p0:u32)->u64 {let mut args=[0u64;1];let base=args.as_mut_ptr() as *mut u8;write_unaligned(base.add(0) as *mut u32,p0);open(&S{n:4,a:4,k:K::Record(&[(0,S{n:4,a:4,k:K::Leaf})])},base as usize as u32)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_host_make_result_14(case:i32,len:u32)->u64 {result(16,4,1,4,5,case,len)}

#[no_mangle]pub unsafe extern "C" fn __wasmc_host_window_18(p0:u32,p1:u32)->u64 {let mut args=[0u64;2];let base=args.as_mut_ptr() as *mut u8;if span(p0,8).is_none(){return 0;}copy_nonoverlapping(p0 as usize as *const u8,base.add(0),8);if span(p1,8).is_none(){return 0;}copy_nonoverlapping(p1 as usize as *const u8,base.add(8),8);open(&S{n:16,a:4,k:K::Record(&[(0,S{n:8,a:4,k:K::String}),(8,S{n:8,a:4,k:K::String})])},base as usize as u32)}
#[no_mangle]pub unsafe extern "C" fn __wasmc_host_make_result_18(case:i32,len:u32,value:u32)->u64 {let p=result(16,4,1,4,5,case,len);if p!=0&&case==-1{write_unaligned((p as u32+4) as usize as *mut u32,value);}p}

}
