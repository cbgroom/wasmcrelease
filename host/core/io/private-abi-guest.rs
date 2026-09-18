// Curated physical-ABI conformance fixture; no application-facing raw handles.
#![no_std]
#[link(wasm_import_module = "heap")]
unsafe extern "C" {
    fn type_bytes() -> i64;
    fn bytes_len(reference: i64, typehandle: i64) -> i64;
    fn bytes_byte_at(reference: i64, typehandle: i64, index: i32) -> i64;
}
#[unsafe(no_mangle)]
pub extern "C" fn run(reference: i64, fail: i32) -> i64 {
    let ty = unsafe { type_bytes() };
    let length = unsafe { bytes_len(reference, ty) } as u64;
    if length >> 32 != 0 {
        return -8;
    }
    let mut total = 0i64;
    for index in 0..length as u32 {
        let item = unsafe { bytes_byte_at(reference, ty, index as i32) } as u64;
        if item >> 32 != 0 {
            return -8;
        }
        total = total.wrapping_add(i64::from(item as u32));
    }
    if fail != 0 {
        return total / i64::from(fail.wrapping_sub(fail));
    }
    total
}
#[panic_handler]
fn panic(_: &core::panic::PanicInfo<'_>) -> ! {
    core::arch::wasm32::unreachable()
}
