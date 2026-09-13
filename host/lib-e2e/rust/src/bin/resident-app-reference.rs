use wasmc_lib_host_e2e::app_engine::AppEngine;
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let mut app = AppEngine::new(
        &args[1],
        &args[2],
        args.iter().any(|arg| arg == "--wasmtime"),
    )
    .unwrap();
    for i in 0..1000 {
        assert_eq!(app.call(&[7, i as u8], 0).unwrap(), 7 + i64::from(i as u8));
    }
    assert_eq!(app.lib_calls(), 1000);
    assert!(app.call(&[1; 17], 0).is_err());
    assert_eq!(app.lib_calls(), 1000);
    assert!(app.call(&[7], 1).is_err());
    assert_eq!(app.lib_calls(), 1001);
    assert!(app.call(&[7], 0).is_err());
    assert_eq!(app.lib_calls(), 1001);
    println!("{{\"accepted\":true,\"resident_calls\":1000,\"trap_poisoned\":true,\"post_trap_no_replay\":true,\"budget_no_lib_call\":true}}");
}
