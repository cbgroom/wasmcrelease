use wasmc::wasmc::json::document::{compact_bytes, read_bool, select_bytes};
#[link(wasm_import_module = "mcpgit:http/v1")]
unsafe extern "C" {
    #[link_name="request-body-len"] fn body_len() -> i32;
    #[link_name="request-body-read"] fn body_read(offset:i32, dest:i32, len:i32) -> i32;
    #[link_name="exchange-response-status"] fn response_status(status:i32) -> i32;
    #[link_name="exchange-response-body-write"] fn response_body(ptr:i32,len:i32) -> i32;
    #[link_name="exchange-control"] fn control(value:i32) -> i32;
}
#[link(wasm_import_module = "mcpgit:table/v1")]
unsafe extern "C" {
    #[link_name="transact"] fn transact(ptr:i32,len:i32) -> i32;
    #[link_name="response-len"] fn response_len(handle:i32) -> i32;
    #[link_name="response-read"] fn response_read(handle:i32, offset:i32, ptr:i32, len:i32) -> i32;
    #[link_name="response-drop"] fn response_drop(handle:i32) -> i32;
}
fn fail(message: &str) -> i32 {
    unsafe { response_status(500); response_body(message.as_ptr() as i32,message.len() as i32); control(1); }
    200
}
fn finish(status:i32, body:&str)->i32 {
    if unsafe{response_status(status)}!=0 || unsafe{response_body(body.as_ptr() as i32,body.len() as i32)}!=0 || unsafe{control(1)}!=0{return 500}
    200
}
#[unsafe(no_mangle)]
pub extern "C" fn handle() -> i32 {
    let n=unsafe {body_len()}; if n<0{return fail("body length")}
    let mut input=vec![0;n as usize];
    if unsafe {body_read(0,input.as_mut_ptr() as i32,n)}!=n{return fail("body read")}
    let output=match compact_bytes(&input){
        Err(_)=>(400,"invalid json".to_string()),
        Ok(json)=>{
            let execute=match read_bool(json.as_bytes(),"/execute") {Ok(v) if v.present=>v.value,_=>return fail("missing execute")};
            if !execute {return finish(202,&json)}
            let transaction=match select_bytes(json.as_bytes(),&["/transaction".to_string()]) {Ok(mut v)=>match v.pop().flatten(){Some(v)=>v,None=>return fail("missing transaction")},Err(_)=>return fail("invalid transaction")};
            let h=unsafe{transact(transaction.as_ptr() as i32,transaction.len() as i32)};
            if h<0{return fail(&format!("transact host error {h}"))}
            let size=unsafe{response_len(h)};
            if size<0 {unsafe{response_drop(h)};return fail("response length")}
            let mut response=vec![0;size as usize];
            let got=unsafe{response_read(h,0,response.as_mut_ptr() as i32,size)};
            let dropped=unsafe{response_drop(h)};
            if got!=size || dropped!=0{return fail("response read or drop")}
            match read_bool(&response,"/applied"){
                Ok(v) if v.present && v.value=>(201,json),
                Ok(v) if v.present=>(409,"transaction conflict".to_string()),
                _=>return fail("response missing applied"),
            }
        }
    };
    finish(output.0,&output.1)
}
