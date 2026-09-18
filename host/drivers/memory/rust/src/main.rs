use wasmc_bounded_memory_reference::{BoundedMemory, MemoryError};

fn code(error: MemoryError) -> &'static str {
    match error {
        MemoryError::Retired => "retired",
        MemoryError::Bounds => "bounds",
        MemoryError::Capacity => "capacity",
    }
}

fn main() {
    let mut memory = BoundedMemory::new(64).expect("memory");
    memory.write(5, b"wasmc").expect("write");
    let read = memory.read(5, 5).expect("read");
    let bounds = memory.read(63, 2).unwrap_err();
    memory.release().expect("release");
    let retired = memory.read(0, 1).unwrap_err();
    println!(
        "{{\"capacity\":64,\"read\":\"{}\",\"bounds\":\"{}\",\"retired\":\"{}\"}}",
        String::from_utf8(read).unwrap(),
        code(bounds),
        code(retired)
    );
}
