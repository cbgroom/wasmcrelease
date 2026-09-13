use crate::scoped::*;
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
