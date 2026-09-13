use crate::scoped::*;
#[test]
fn fresh_bindings_survive_process_owner_budget_without_stale_access() {
    let mut old = ScopedCompletionGuard::fresh().unwrap();
    let w = old.acquire(1).unwrap();
    let op = old.submit(&w).unwrap();
    for _ in 0..40000 {
        let mut g = ScopedCompletionGuard::fresh().unwrap();
        let fresh_w = g.acquire(1).unwrap();
        let fresh_op = g.submit(&fresh_w).unwrap();
        assert_eq!(
            w.to_wire().split(':').nth(1),
            fresh_w.to_wire().split(':').nth(1)
        );
        assert_ne!(w, fresh_w);
        assert_eq!(g.complete(&op, &[9], 0), Err(-1));
        assert_eq!(g.release(&w), Err(-1));
        assert_eq!(g.counts(), [1, 1]);
        g.complete(&fresh_op, &[7], 0).unwrap();
        assert_eq!(g.read(&fresh_w), Ok(vec![7]));
        g.release(&fresh_op).unwrap();
        g.release(&fresh_w).unwrap();
        assert_eq!(g.counts(), [0, 0]);
    }
    assert_eq!(old.counts(), [1, 1]);
    old.cancel(&op).unwrap();
    old.complete(&op, &[], -8).unwrap();
    old.release(&op).unwrap();
    old.release(&w).unwrap();
}
#[test]
fn strict_identity_and_token_round_trip() {
    assert_eq!(BindingIdentity::from_bytes([0; 32]), Err(-5));
    for text in [
        "".to_string(),
        "0".repeat(64),
        "A".repeat(64),
        "f".repeat(63),
    ] {
        assert_eq!(BindingIdentity::from_hex(&text), Err(-5));
    }
    let identity = BindingIdentity::from_bytes([1; 32]).unwrap();
    let mut g = ScopedCompletionGuard::new(identity).unwrap();
    let w = g.acquire(1).unwrap();
    assert_eq!(ScopedToken::from_wire(&w.to_wire()), Ok(w));
    for local in ["0", "01", "2147483648", "-1", "1:extra"] {
        assert_eq!(
            ScopedToken::from_wire(&format!("{}:{local}", "01".repeat(32))),
            Err(-1)
        );
    }
    g.release(&w).unwrap();
    assert_eq!(g.counts(), [0, 0]);
}
#[test]
fn foreign_identity_does_not_mutate_or_unpin() {
    let mut a = ScopedCompletionGuard::new(BindingIdentity::from_bytes([1; 32]).unwrap()).unwrap();
    let mut b = ScopedCompletionGuard::new(BindingIdentity::from_bytes([2; 32]).unwrap()).unwrap();
    let w = a.acquire(1).unwrap();
    let op = a.submit(&w).unwrap();
    assert_eq!(b.submit(&w), Err(-1));
    assert_eq!(b.complete(&op, &[9], 0), Err(-1));
    assert_eq!(b.release(&w), Err(-1));
    assert_eq!(b.counts(), [0, 0]);
    assert_eq!(a.counts(), [1, 1]);
    assert_eq!(a.release(&w), Err(-4));
    a.cancel(&op).unwrap();
    a.complete(&op, &[7], 0).unwrap();
    assert_eq!(a.read(&w), Ok(vec![]));
    a.release(&op).unwrap();
    a.release(&w).unwrap();
    assert_eq!(a.counts(), [0, 0]);
}
