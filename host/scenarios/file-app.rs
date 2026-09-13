#![no_std]

#[link(wasm_import_module = "transport")]
unsafe extern "C" {
    fn sum_window(length: i32) -> i64;
}

#[unsafe(no_mangle)]
pub extern "C" fn run(length: i32, fail: i32) -> i64 {
    let total = unsafe { sum_window(length) };
    let guard = 1 / (1 - fail);
    if guard == 1 { total } else { total + 1 }
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo<'_>) -> ! {
    core::arch::wasm32::unreachable()
}
