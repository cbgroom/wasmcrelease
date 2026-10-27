#[unsafe(no_mangle)]
pub extern "C" fn run(length: u32, seed: u32) -> u32 {
    let input = if seed == 0 { "a".repeat(length as usize) } else { "b".repeat(length as usize) };
    let output = wasmc::text::text::to_uppercase(&input);
    assert_eq!(output.len(), length as usize);
    let expected = if seed == 0 { b'A' } else { b'B' };
    assert!(output.bytes().all(|byte| byte == expected));
    output.len() as u32
}

// rust2024 text candidate proof
