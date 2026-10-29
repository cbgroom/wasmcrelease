use wasmc::wasmc::json::document::compact;
#[link(wasm_import_module = "mcpgit:http/v1")]
unsafe extern "C" {
    #[link_name="request-body-len"] fn body_len() -> i32;
    #[link_name="request-body-read"] fn body_read(offset:i32, dest:i32, len:i32) -> i32;
    #[link_name="exchange-response-status"] fn response_status(status:i32) -> i32;
    #[link_name="exchange-response-body-write"] fn response_body(ptr:i32,len:i32) -> i32;
    #[link_name="exchange-response-body-len"] fn response_len() -> i32;
    #[link_name="exchange-response-body-read"] fn response_read(offset:i32, ptr:i32, len:i32) -> i32;
    #[link_name="exchange-control"] fn control(value:i32) -> i32;
}
#[link(wasm_import_module = "mcpgit:table/v1")]
unsafe extern "C" {
    #[link_name="status"] fn table_status(ptr:i32, len:i32) -> i32;
    #[link_name="response-drop"] fn table_response_drop(handle:i32) -> i32;
}
#[unsafe(no_mangle)]
pub extern "C" fn handle() -> i32 {
    let n = unsafe { body_len() }; if n < 0 { return 500; }
    let mut bytes = vec![0; n as usize];
    if unsafe { body_read(0, bytes.as_mut_ptr() as i32, n) } != n { return 500; }
    let path = "json_results";
    let h = unsafe { table_status(path.as_ptr() as i32, path.len() as i32) };
    if h < 0 || unsafe { table_response_drop(h) } != 0 { return 500; }
    let (status, body) = match compact(std::str::from_utf8(&bytes).expect("valid UTF-8 request")) { Ok(value) => (200, value), Err(_) => (400, "invalid json".to_string()) };
    let body = if bytes == br#"{"large":true}"# { "x".repeat(3_000_000) } else { body };
    if unsafe { response_status(status) } != 0 { return 500; }
    if bytes == br#"{"large":true}"# {
        let old = b"old";
        if unsafe { response_body(old.as_ptr() as i32, old.len() as i32) } != 0 { return 500; }
    }
    if unsafe { response_body(body.as_ptr() as i32, body.len() as i32) } != 0 {
        let mut previous = [0u8; 3];
        if unsafe { response_len() } != 3 || unsafe { response_read(0, previous.as_mut_ptr() as i32, 3) } != 3 || &previous != b"old" { return 500; }
        let fallback = b"budget";
        if unsafe { response_status(507) } != 0 || unsafe { response_body(fallback.as_ptr() as i32, fallback.len() as i32) } != 0 || unsafe { control(1) } != 0 { return 500; }
        return 200;
    }
    if unsafe { control(1) } != 0 { return 500; }
    200
}
