use wasmc::wasmc::json::document::{compact, validate, validate_bytes};
#[unsafe(no_mangle)]
pub extern "C" fn run(count: u32) -> u32 {
    let text = if count == 0 { "[]".to_owned() } else { format!("[{}0]", "0,".repeat(count as usize - 1)) };
    let mut flags=0;
    if validate_bytes(text.as_bytes()).is_ok() {flags|=1;}
    if compact(&text).is_ok_and(|s|s==text){flags|=2;}
    if validate("[0,]").is_err(){flags|=4;}
    if validate("[1,2]").is_ok(){flags|=8;}
    flags
}
