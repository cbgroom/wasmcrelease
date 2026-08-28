fn main() {
    let evidence = wasmc_wasmtime_demo::exercise().expect("wasmc release demo failed");
    println!("PASS: generated_bytes={} scalar={} resource={} host={}", evidence.0, evidence.1, evidence.2, evidence.3);
}
