//! OS source availability only; no candidate Host ABI or guest authority proof.
#[test]
fn real_monotonic_and_wall_clock_sources() {
    use std::time::{Instant, SystemTime, UNIX_EPOCH};
    let start = Instant::now();
    for _ in 0..32 {
        assert!(Instant::now() >= start);
    }
    assert!(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            > 0
    );
}
#[test]
fn real_os_entropy_source_without_prng_fallback() {
    let mut a = [0u8; 32];
    let mut b = [0u8; 32];
    getrandom::fill(&mut a).unwrap();
    getrandom::fill(&mut b).unwrap();
    assert_ne!(a, b);
    assert_ne!(a, [0; 32]);
}
