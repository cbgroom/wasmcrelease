use super::*;
const MEM: &str = "MemAvailable: 100 kB\nSwapTotal: 20 kB\nSwapFree: 5 kB\n";
const NET:&str="Inter-| Receive | Transmit\n face |bytes packets errs drop fifo frame compressed multicast|bytes packets errs drop fifo colls carrier compressed\neth0: 10 0 0 0 0 0 0 0 20 0 0 0 0 0 0 0\nlo: 999 0 0 0 0 0 0 0 999 0 0 0 0 0 0 0\n";
fn input(cpu: &str) -> Snapshots<'_> {
    Snapshots {
        cpu: Some(cpu),
        memory: Some(MEM),
        network: Some(NET),
        load: Some("1.25 0 0 1/1 1"),
    }
}
#[test]
fn cpu_ignores_guest() {
    assert_eq!(parse_cpu("cpu 10 2 3 80 5 0 0 0 999 999"), Ok((100, 85)));
}
#[test]
fn cpu_requires_aggregate() {
    assert_eq!(parse_cpu("cpu0 1 2 3 4"), Err(Error::MalformedInput));
}
#[test]
fn cpu_rejects_short() {
    assert_eq!(parse_cpu("cpu 1 2"), Err(Error::MalformedInput));
}
#[test]
fn cpu_checks_overflow() {
    assert_eq!(
        parse_cpu("cpu 18446744073709551615 1 0 0"),
        Err(Error::Overflow)
    );
}
#[test]
fn memory_units() {
    assert_eq!(parse_memory(MEM), Ok((102400, 15360)));
}
#[test]
fn memory_missing() {
    assert_eq!(
        parse_memory("MemAvailable: 1 kB\n"),
        Err(Error::MissingInput)
    );
}
#[test]
fn memory_bad_units() {
    assert_eq!(
        parse_memory(&MEM.replace("100 kB", "100 MB")),
        Err(Error::MalformedInput)
    );
}
#[test]
fn memory_overflow() {
    assert_eq!(
        parse_memory(&MEM.replace("100", "18446744073709551615")),
        Err(Error::Overflow)
    );
}
#[test]
fn memory_duplicate() {
    assert_eq!(
        parse_memory(&(MEM.to_owned() + "MemAvailable: 1 kB\n")),
        Err(Error::MalformedInput)
    );
}
#[test]
fn memory_bad_swap() {
    assert_eq!(
        parse_memory(&MEM.replace("5 kB", "25 kB")),
        Err(Error::MalformedInput)
    );
}
#[test]
fn network_loopback() {
    assert_eq!(parse_network(NET), Ok((10, 20)));
}
#[test]
fn network_truncated() {
    assert_eq!(
        parse_network("Inter-| Receive | Transmit\nbytes packets\neth0: 1 2"),
        Err(Error::MalformedInput)
    );
}
#[test]
fn network_missing_headers() {
    assert_eq!(parse_network(""), Err(Error::MalformedInput));
}
#[test]
fn load_decimal() {
    assert_eq!(parse_load("1.23499 0 0"), Ok(1234));
}
#[test]
fn load_bad_values() {
    for s in ["NaN", "inf", "-1.0", "1.x"] {
        assert_eq!(parse_load(s), Err(Error::MalformedInput));
    }
}
#[test]
fn load_overflow() {
    assert_eq!(parse_load("4294967.296"), Err(Error::Overflow));
}
#[test]
fn first_rate_unavailable() {
    let f = Sampler::new(Profile::Fast)
        .sample(0, input("cpu 10 0 0 90"))
        .unwrap();
    assert_eq!(f.cpu_milli_pct, None);
    assert_eq!(f.freshness_mask, ALL);
    assert_eq!(f.encode().unwrap()[60], 1);
}
#[test]
fn cpu_delta() {
    let mut s = Sampler::new(Profile::Fast);
    s.sample(0, input("cpu 10 0 0 90")).unwrap();
    assert_eq!(
        s.sample(10_000_000, input("cpu 30 0 0 110"))
            .unwrap()
            .cpu_milli_pct,
        Some(50_000)
    );
}
#[test]
fn reset_not_zero() {
    let mut s = Sampler::new(Profile::Fast);
    s.sample(0, input("cpu 10 0 0 90")).unwrap();
    assert_eq!(
        s.sample(10_000_000, input("cpu 1 0 0 9"))
            .unwrap()
            .cpu_milli_pct,
        None
    );
}
#[test]
fn no_progress() {
    let mut s = Sampler::new(Profile::Fast);
    s.sample(0, input("cpu 10 0 0 90")).unwrap();
    assert_eq!(
        s.sample(1, input("cpu 10 0 0 90")).unwrap().cpu_milli_pct,
        None
    );
}
#[test]
fn cache_not_fresh() {
    let mut s = Sampler::new(Profile::Balanced);
    s.sample(0, input("cpu 10 0 0 90")).unwrap();
    let f = s.sample(1_000_000, Snapshots::default()).unwrap();
    assert_eq!(f.freshness_mask, 0);
    assert_eq!(f.available_memory, 102400);
    assert_eq!(s.refresh_mask(10_000_000).unwrap(), 7);
}
#[test]
fn clock_regression() {
    let mut s = Sampler::new(Profile::Fast);
    s.sample(100, input("cpu 10 0 0 90")).unwrap();
    assert_eq!(s.refresh_mask(99), Err(Error::ClockRegressed));
}
#[test]
fn transactional_failure() {
    let mut s = Sampler::new(Profile::Fast);
    let f = s.sample(0, input("cpu 10 0 0 90")).unwrap();
    let mut bad = input("cpu 30 0 0 110");
    bad.network = Some("bad");
    assert_eq!(s.sample(10_000_000, bad), Err(Error::MalformedInput));
    assert_eq!(s.frame, f);
    assert_eq!(
        s.sample(10_000_000, input("cpu 30 0 0 110"))
            .unwrap()
            .cpu_milli_pct,
        Some(50_000)
    );
}
#[test]
fn required_input() {
    assert_eq!(
        Sampler::new(Profile::Fast).sample(0, Snapshots::default()),
        Err(Error::MissingInput)
    );
}
#[test]
fn input_bound() {
    let big = "x".repeat(MAX_SNAPSHOT_BYTES + 1);
    let mut data = input("cpu 1 0 0 9");
    data.load = Some(&big);
    assert_eq!(
        Sampler::new(Profile::Fast).sample(0, data),
        Err(Error::InputTooLarge)
    );
}
#[test]
fn encode_checks() {
    assert_eq!(
        Frame {
            cpu_milli_pct: Some(100001),
            ..Frame::default()
        }
        .encode(),
        Err(Error::MalformedInput)
    );
    assert_eq!(
        Frame {
            freshness_mask: 16,
            ..Frame::default()
        }
        .encode(),
        Err(Error::MalformedInput)
    );
}
#[test]
fn state_isolation() {
    let mut a = Sampler::new(Profile::Fast);
    let mut b = Sampler::new(Profile::Economy);
    a.sample(0, input("cpu 1 0 0 9")).unwrap();
    assert_eq!(b.sample(0, input("cpu 100 0 0 900")).unwrap().sequence, 1);
    assert_eq!(a.refresh_mask(1), Ok(CPU | NETWORK));
    assert_eq!(b.refresh_mask(1), Ok(0));
}
