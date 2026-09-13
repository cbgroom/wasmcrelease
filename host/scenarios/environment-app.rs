#![no_std]
#[link(wasm_import_module = "environment")]
unsafe extern "C" {
    fn clock_read() -> i64;
    fn entropy_fill() -> i32;
    fn nonce_sum() -> i64;
}
#[unsafe(no_mangle)]
pub extern "C" fn run() -> i64 {
    // These functions are the embedding's explicit, restricted import contract.
    let before = unsafe { clock_read() };
    let count = unsafe { entropy_fill() };
    let after = unsafe { clock_read() };
    if after < before {
        return -1;
    }
    if count != 16 {
        return -2;
    }
    unsafe { nonce_sum() }
}
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}
