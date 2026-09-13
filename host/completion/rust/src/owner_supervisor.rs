//! Trusted Native ownership registry, not a guest ABI or asynchronous I/O driver.
use crate::scoped::{BindingIdentity, ScopedCompletionGuard, ScopedToken};
use std::collections::BTreeMap;

pub trait QuarantineEndpoint {
    /// Must acknowledge real close AND already-issued I/O settlement.
    fn acknowledge_close(&mut self) -> Result<(), i32>;
    fn retire(&mut self) -> Result<(), i32>;
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct OwnerTicket {
    identity: BindingIdentity,
    local: u16,
}
struct Owner<E> {
    endpoint: E,
    guard: ScopedCompletionGuard,
    window: ScopedToken,
    operation: ScopedToken,
    quarantined: bool,
    capacity: usize,
}
pub struct NativeOwnerSupervisor<E> {
    identity: BindingIdentity,
    next: u16,
    limit: usize,
    owners: BTreeMap<u16, Owner<E>>,
}
impl<E: QuarantineEndpoint> NativeOwnerSupervisor<E> {
    pub fn new(limit: usize) -> Result<Self, i32> {
        if !(1..=16).contains(&limit) {
            return Err(-5);
        }
        Ok(Self {
            identity: BindingIdentity::issue()?,
            next: 1,
            limit,
            owners: BTreeMap::new(),
        })
    }
    /// Failure returns the untouched endpoint; caller retains ownership.
    pub fn admit(&mut self, endpoint: E, size: i32) -> Result<OwnerTicket, (i32, E)> {
        if self.owners.len() >= self.limit {
            return Err((-3, endpoint));
        }
        if self.next > 32767 {
            // No old owner/pin may survive identity rotation.
            if !self.owners.is_empty() {
                return Err((-3, endpoint));
            }
            let identity = match BindingIdentity::issue() {
                Ok(identity) => identity,
                Err(code) => return Err((code, endpoint)),
            };
            self.identity = identity;
            self.next = 1;
        }
        let resources = (|| {
            let mut guard = ScopedCompletionGuard::fresh()?;
            let window = guard.acquire(size)?;
            let operation = guard.submit(&window)?;
            Ok::<_, i32>((guard, window, operation))
        })();
        let (guard, window, operation) = match resources {
            Ok(r) => r,
            Err(code) => return Err((code, endpoint)),
        };
        let ticket = OwnerTicket {
            identity: self.identity,
            local: self.next,
        };
        self.next += 1;
        self.owners.insert(
            ticket.local,
            Owner {
                endpoint,
                guard,
                window,
                operation,
                quarantined: false,
                capacity: size as usize,
            },
        );
        Ok(ticket)
    }
    fn local(&self, ticket: OwnerTicket) -> Result<u16, i32> {
        if ticket.identity != self.identity || !self.owners.contains_key(&ticket.local) {
            Err(-1)
        } else {
            Ok(ticket.local)
        }
    }
    pub fn endpoint_mut(&mut self, ticket: OwnerTicket) -> Result<&mut E, i32> {
        let local = self.local(ticket)?;
        let owner = self.owners.get_mut(&local).unwrap();
        if owner.quarantined {
            Err(-2)
        } else {
            Ok(&mut owner.endpoint)
        }
    }
    /// Called only by a trusted settled backend, never by the guest.
    pub fn finish_settled(
        &mut self,
        ticket: OwnerTicket,
        bytes: &[u8],
        error: i32,
    ) -> Result<Vec<u8>, i32> {
        let local = self.local(ticket)?;
        let owner = self.owners.get_mut(&local).unwrap();
        if owner.quarantined {
            return Err(-2);
        }
        if bytes.len() > owner.capacity || error > 0 {
            return Err(-5);
        }
        if let Err(code) = owner
            .endpoint
            .acknowledge_close()
            .and_then(|()| owner.endpoint.retire())
        {
            self.quarantine_settled(ticket)?;
            return Err(code);
        }
        owner.guard.complete(&owner.operation, bytes, error)?;
        let value = if error == 0 {
            owner.guard.read(&owner.window)?
        } else {
            Vec::new()
        };
        owner.guard.release(&owner.operation)?;
        owner.guard.release(&owner.window)?;
        self.owners.remove(&local);
        if error == 0 {
            Ok(value)
        } else {
            Err(error)
        }
    }
    /// Trusted backend invokes only after its issued I/O has settled/joined.
    pub fn quarantine_settled(&mut self, ticket: OwnerTicket) -> Result<(), i32> {
        let local = self.local(ticket)?;
        let owner = self.owners.get_mut(&local).unwrap();
        if owner.quarantined {
            return Err(-4);
        }
        owner.guard.cancel(&owner.operation)?;
        owner.guard.revoke();
        owner.quarantined = true;
        Ok(())
    }
    pub fn counts(&self) -> [usize; 2] {
        let q = self.owners.values().filter(|o| o.quarantined).count();
        [self.owners.len() - q, q]
    }
    pub fn resource_counts(&self, ticket: OwnerTicket) -> Result<[usize; 2], i32> {
        Ok(self.owners[&self.local(ticket)?].guard.counts())
    }
    /// Exclusive &mut prevents overlapping retirement. Never reissues I/O.
    pub fn retire_quarantine(&mut self, ticket: OwnerTicket) -> Result<(), i32> {
        let local = self.local(ticket)?;
        let owner = self.owners.get_mut(&local).unwrap();
        if !owner.quarantined {
            return Err(-4);
        }
        owner.endpoint.acknowledge_close()?;
        owner.endpoint.retire()?;
        owner.guard.complete(&owner.operation, &[], -8)?;
        owner.guard.release(&owner.operation)?;
        owner.guard.release(&owner.window)?;
        self.owners.remove(&local);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Endpoint {
        closed: bool,
        retire_ok: bool,
        retired: bool,
    }
    impl QuarantineEndpoint for Endpoint {
        fn acknowledge_close(&mut self) -> Result<(), i32> {
            if self.closed {
                Ok(())
            } else {
                Err(-8)
            }
        }
        fn retire(&mut self) -> Result<(), i32> {
            if self.retire_ok {
                self.retired = true;
                Ok(())
            } else {
                Err(-8)
            }
        }
    }
    fn endpoint() -> Endpoint {
        Endpoint {
            closed: false,
            retire_ok: true,
            retired: false,
        }
    }
    fn admit(s: &mut NativeOwnerSupervisor<Endpoint>) -> OwnerTicket {
        match s.admit(endpoint(), 16) {
            Ok(t) => t,
            Err(_) => panic!("admission failed"),
        }
    }
    #[test]
    fn quota_foreign_and_unacknowledged_close_keep_ownership() {
        let mut s = NativeOwnerSupervisor::new(1).unwrap();
        let t = admit(&mut s);
        assert_eq!(s.counts(), [1, 0]);
        assert_eq!(s.retire_quarantine(t), Err(-4));
        let (code, returned) = s.admit(endpoint(), 1).err().unwrap();
        assert_eq!(code, -3);
        assert!(!returned.retired);
        s.quarantine_settled(t).unwrap();
        assert_eq!(s.counts(), [0, 1]);
        assert_eq!(s.retire_quarantine(t), Err(-8));
        assert_eq!(s.resource_counts(t), Ok([1, 1]));
        let mut foreign = NativeOwnerSupervisor::<Endpoint>::new(1).unwrap();
        assert_eq!(foreign.retire_quarantine(t), Err(-1));
        let local = s.local(t).unwrap();
        s.owners.get_mut(&local).unwrap().endpoint.closed = true;
        s.retire_quarantine(t).unwrap();
        assert_eq!(s.counts(), [0, 0]);
        assert_eq!(s.retire_quarantine(t), Err(-1));
    }
    #[test]
    fn retirement_failure_and_live_owner_prevent_epoch_rotation() {
        let mut s = NativeOwnerSupervisor::new(1).unwrap();
        let t = admit(&mut s);
        s.quarantine_settled(t).unwrap();
        let local = s.local(t).unwrap();
        let e = &mut s.owners.get_mut(&local).unwrap().endpoint;
        e.closed = true;
        e.retire_ok = false;
        assert_eq!(s.retire_quarantine(t), Err(-8));
        assert_eq!(s.resource_counts(t), Ok([1, 1]));
        s.next = 32768;
        assert_eq!(s.admit(endpoint(), 1).err().unwrap().0, -3);
        s.owners.get_mut(&local).unwrap().endpoint.retire_ok = true;
        s.retire_quarantine(t).unwrap();
        let fresh = admit(&mut s);
        assert!(fresh.identity != t.identity);
        assert_eq!(s.retire_quarantine(t), Err(-1));
        s.quarantine_settled(fresh).unwrap();
        let local = s.local(fresh).unwrap();
        s.owners.get_mut(&local).unwrap().endpoint.closed = true;
        s.retire_quarantine(fresh).unwrap();
    }
    #[test]
    fn forty_thousand_settled_owners_rotate_only_after_retirement() {
        let mut s = NativeOwnerSupervisor::new(1).unwrap();
        let mut first = None;
        for _ in 0..40000 {
            let mut e = endpoint();
            e.closed = true;
            let ticket = s.admit(e, 1).ok().unwrap();
            if let Some(old) = first {
                assert_eq!(s.retire_quarantine(old), Err(-1));
            } else {
                first = Some(ticket);
            }
            assert_eq!(s.finish_settled(ticket, &[7], 0), Ok(vec![7]));
            assert_eq!(s.counts(), [0, 0]);
        }
    }
    #[test]
    fn invalid_limits_and_size_do_not_consume_endpoint() {
        assert!(matches!(NativeOwnerSupervisor::<Endpoint>::new(0), Err(-5)));
        assert!(matches!(
            NativeOwnerSupervisor::<Endpoint>::new(17),
            Err(-5)
        ));
        let mut s = NativeOwnerSupervisor::new(1).unwrap();
        let (code, e) = s.admit(endpoint(), 17).err().unwrap();
        assert_eq!(code, -5);
        assert!(!e.retired);
        assert_eq!(s.counts(), [0, 0]);
    }
    #[test]
    fn normal_completion_and_failed_retirement_preserve_budget_and_owner() {
        let mut s = NativeOwnerSupervisor::new(1).unwrap();
        let t = admit(&mut s);
        assert_eq!(s.finish_settled(t, &[1; 17], 0), Err(-5));
        assert_eq!(s.resource_counts(t), Ok([1, 1]));
        s.endpoint_mut(t).unwrap().closed = true;
        assert_eq!(s.finish_settled(t, &[7], 0), Ok(vec![7]));
        assert_eq!(s.counts(), [0, 0]);
        let t = admit(&mut s);
        assert_eq!(s.finish_settled(t, &[7], 0), Err(-8));
        assert_eq!(s.counts(), [0, 1]);
        assert!(matches!(s.endpoint_mut(t), Err(-2)));
        assert_eq!(s.resource_counts(t), Ok([1, 1]));
        let local = s.local(t).unwrap();
        s.owners.get_mut(&local).unwrap().endpoint.closed = true;
        s.retire_quarantine(t).unwrap();
        assert_eq!(s.counts(), [0, 0]);
    }
}
