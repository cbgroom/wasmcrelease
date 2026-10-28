use mcpgit::{table,service,output};
#[unsafe(no_mangle)] pub extern "C" fn run()->i32 {
 let number=Some(42);
 if let Some(value)=number && value == 42 {
  let response=table::status("data/tables/mcpgit_smoke_runs").unwrap();
  let n=response.len().unwrap(); service::finish_json(response).unwrap(); output::finish_i64(n as i64); return 0;
 }
 1
}
#[panic_handler] fn panic(_: &core::panic::PanicInfo<'_>)->! {loop{}}
