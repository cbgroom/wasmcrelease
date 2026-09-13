use super::*;
#[test]
fn exhausted_sequence_does_not_wrap_or_leak() {
    let mut g = CompletionGuard::new().unwrap();
    let mut previous = 0;
    for _ in 0..32767 {
        let id = g.acquire(0).unwrap();
        assert!(id > previous);
        previous = id;
        g.release(id).unwrap();
    }
    assert_eq!(g.acquire(0), Err(-3));
    assert_eq!(g.counts(), [0, 0]);
}
#[test]
fn failed_completion_drains_without_bytes() {
    let mut g = CompletionGuard::new().unwrap();
    let w = g.acquire(1).unwrap();
    let op = g.submit(w).unwrap();
    g.complete(op, &[], -8).unwrap();
    assert_eq!(g.poll(op), Ok(("failed", true, -8)));
    assert_eq!(g.read(w), Ok(vec![]));
    g.release(op).unwrap();
    g.release(w).unwrap();
    assert_eq!(g.counts(), [0, 0]);
}
#[test]
fn old_completion_cannot_overwrite_reused_window() {
    let mut g = CompletionGuard::new().unwrap();
    let w = g.acquire(1).unwrap();
    let a = g.submit(w).unwrap();
    g.complete(a, &[1], 0).unwrap();
    let b = g.submit(w).unwrap();
    assert_eq!(g.complete(a, &[9], 0), Err(-1));
    assert_eq!(g.read(w), Err(-4));
    let mut bytes = vec![2];
    g.complete(b, &bytes, 0).unwrap();
    bytes[0] = 9;
    let mut read = g.read(w).unwrap();
    read[0] = 8;
    assert_eq!(g.read(w), Ok(vec![2]));
    g.release(a).unwrap();
    g.release(b).unwrap();
    g.release(w).unwrap();
    assert_eq!(g.counts(), [0, 0]);
}
#[test]
fn concurrent_session_allocator_is_unique() {
    let threads: Vec<_> = (0..8)
        .map(|_| {
            std::thread::spawn(|| {
                (0..64)
                    .map(|_| CompletionGuard::new().unwrap().owner)
                    .collect::<Vec<_>>()
            })
        })
        .collect();
    let mut ids: Vec<_> = threads
        .into_iter()
        .flat_map(|t| t.join().unwrap())
        .collect();
    assert_eq!(ids.len(), 512);
    ids.sort_unstable();
    ids.dedup();
    assert_eq!(ids.len(), 512);
    // Allocator uniqueness only, not concurrent shared registry transitions.
}
