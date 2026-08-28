#[test]
fn release_journey() {
    assert_eq!(wasmc_wasmtime_demo::exercise().unwrap(), (44, 17, 15, 42));
}
