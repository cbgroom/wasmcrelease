use wasmc::wasmc::json::document::compact_bytes;
#[link(wasm_import_module = "mcpgit:http/v1")]
unsafe extern "C" {
    #[link_name="request-body-len"] fn body_len() -> i32;
    #[link_name="request-body-read"] fn body_read(offset:i32, dest:i32, len:i32) -> i32;
    #[link_name="response-canonical-write"] fn response(status:i32, data:i32, len:i32) -> i32;
}
#[unsafe(no_mangle)]
pub extern "C" fn handle() -> i32 {
    let n = unsafe { body_len() };
    if n < 0 { return 500; }
    let mut bytes = vec![0; n as usize];
    if unsafe { body_read(0, bytes.as_mut_ptr() as i32, n) } != n { return 500; }
    match compact_bytes(&bytes) {
        Ok(value) => unsafe { response(200, value.as_ptr() as i32, value.len() as i32) },
        Err(_) => unsafe { response(400, b"invalid json".as_ptr() as i32, 12) },
    }
}
