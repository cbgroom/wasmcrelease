use wasmc::wasmc::json::document::{compact, read_u64, validate, validate_bytes};
#[unsafe(no_mangle)]
pub extern "C" fn run(size: u32) -> u32 {
    let pad = "x".repeat(size as usize);
    let text = format!("{{\"payload\":\"{pad}\",\"value\":18446744073709551615}}");
    let mut flags = 0;
    if validate_bytes(text.as_bytes()).is_ok() { flags |= 1; }
    if read_u64(text.as_bytes(), "/value").is_ok_and(|v| v.present && v.value == u64::MAX) { flags |= 2; }
    if compact(&text).is_ok_and(|v| v == text) { flags |= 4; }
    let invalid = format!("{{\"payload\":\"{pad}\",\"x\":1e400,\"x\":1}}");
    if validate(&invalid).is_err() { flags |= 8; }
    if validate("{\"recovered\":true}").is_ok() { flags |= 16; }
    flags
}
