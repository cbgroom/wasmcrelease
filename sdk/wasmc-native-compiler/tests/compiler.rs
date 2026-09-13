use wasmc_native_compiler::{Compiler, Limits};
#[test]
fn resident_diagnostic_recovery_and_repeat() {
    let mut compiler = Compiler::new(Limits::default()).unwrap();
    let source = include_str!("../../../examples/agent-start/01_add.wasmc");
    let first = compiler.compile(source).unwrap();
    assert_eq!(&first[..4], b"\0asm");
    assert!(compiler.compile("invalid source").is_err());
    assert_eq!(first, compiler.compile(source).unwrap());
}
#[test]
fn rejects_source_and_zero_limits() {
    assert!(Compiler::new(Limits {
        fuel: 0,
        ..Limits::default()
    })
    .is_err());
    let mut compiler = Compiler::new(Limits {
        source_bytes: 1,
        ..Limits::default()
    })
    .unwrap();
    assert!(compiler.compile("too large").is_err());
}
#[test]
fn fuel_exhaustion_poisoned_instance() {
    let mut compiler = Compiler::new(Limits {
        fuel: 100,
        ..Limits::default()
    })
    .unwrap();
    let source = include_str!("../../../examples/agent-start/01_add.wasmc");
    assert!(compiler.compile(source).is_err());
    assert_eq!(
        compiler.compile(source).unwrap_err(),
        "compiler instance poisoned"
    );
}
