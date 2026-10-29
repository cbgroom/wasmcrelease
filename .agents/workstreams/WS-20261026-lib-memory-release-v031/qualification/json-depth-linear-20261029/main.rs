#[path = "/Users/youxianshi/.local/state/wasmc-maintenance/rustc-service-1991-20261028/json-v031-overlay-private-qualified-20261029/proof/json-q0/source/libspec/wasmc-json/delta.rs"]
mod delta;
use std::time::Instant;
fn main() {
    for depth in [500, 1000, 2000, 4000, 8000] {
        let input = format!("{}0{}", "[".repeat(depth), "]".repeat(depth));
        let t = Instant::now();
        let out = delta::compact(input.as_bytes()).expect("valid deep JSON");
        assert_eq!(out, input);
        println!("depth={depth} bytes={} elapsed_us={}", input.len(), t.elapsed().as_micros());
    }
}
