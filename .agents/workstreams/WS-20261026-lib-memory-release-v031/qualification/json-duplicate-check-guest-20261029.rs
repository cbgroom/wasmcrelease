use wasmc::wasmc::json::document::{compact,read_u64,validate,validate_bytes};
#[unsafe(no_mangle)]
pub extern "C" fn run() -> u32 {
    let bad=[r#"{"x":1e400,"x":1}"#, r#"{"x":{"z":1e400},"x":1}"#, r#"[{"x":1e400,"x":1}]"#];
    let mut flags=0;
    if bad.iter().all(|s| validate(s).is_err() && validate_bytes(s.as_bytes()).is_err()) {flags|=1;}
    if bad.iter().all(|s| compact(s).is_err()) {flags|=2;}
    let good=r#"{"x":1,"x":2,"y":{"a":3,"a":4}}"#;
    if compact(good).ok().as_deref()==Some(r#"{"x":2,"y":{"a":4}}"#) {flags|=4;}
    if read_u64(good.as_bytes(),"/x").is_ok_and(|v|v.present && v.value==2) {flags|=8;}
    if validate(r#"{"ok":true}"#).is_ok() {flags|=16;}
    flags
}
