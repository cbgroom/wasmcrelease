#[test]
fn public_artifacts_work_together() {
    assert_eq!(wasmc_wasmtime_demo::exercise().unwrap(), (44, 17));
}
