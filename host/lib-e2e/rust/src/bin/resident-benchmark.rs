use std::time::Instant;
use wasmc_lib_host_e2e::app_engine::AppEngine;

fn main() {
    let args: Vec<_> = std::env::args().collect();
    let jit = args.iter().any(|arg| arg == "--wasmtime");
    let start = Instant::now();
    let mut app = AppEngine::new(&args[1], &args[2], jit).unwrap();
    let init_ms = start.elapsed().as_secs_f64() * 1000.0;
    for i in 0..1000 {
        assert_eq!(app.call(&[7, (i % 200) as u8], 0).unwrap(), 7 + i % 200);
    }
    let mut samples = Vec::new();
    let mut checksum = 0_i64;
    for _ in 0..7 {
        let start = Instant::now();
        let mut total = 0_i64;
        for i in 0..100_000 {
            total += app.call(&[7, (i % 200) as u8], 0).unwrap();
        }
        samples.push(start.elapsed().as_secs_f64() * 1000.0);
        assert_eq!(total, 10_650_000);
        checksum += total;
    }
    assert_eq!(app.lib_calls(), 701_000);
    println!(
        "{{\"accepted\":true,\"engine\":\"{}\",\"init_ms\":{},\"samples_ms\":{:?},\"calls_per_sample\":100000,\"checksum\":{},\"lib_calls\":701000}}",
        if jit { "wasmtime" } else { "wasmi" },
        init_ms,
        samples,
        checksum
    );
}
