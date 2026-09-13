//! Shared bounded Native read driver, not guest transport or an executor.
use crate::{
    nonblocking_tcp::{NonblockingTcpRead, ReadProgress},
    owner_supervisor::{NativeOwnerSupervisor, OwnerTicket},
};
use mio::{Events, Poll, Token, Waker};
use std::{
    collections::BTreeMap,
    io,
    sync::{Arc, Mutex},
    time::Instant,
};

struct Control {
    pending: BTreeMap<usize, bool>,
    wake: Option<Waker>,
}
pub struct ReactorCancellation {
    id: usize,
    control: Arc<Mutex<Control>>,
}
impl ReactorCancellation {
    pub fn cancel(&self) -> Result<(), i32> {
        let mut state = self.control.lock().map_err(|_| -8)?;
        let cancelled = state.pending.get_mut(&self.id).ok_or(-1)?;
        if *cancelled {
            return Err(-4);
        }
        *cancelled = true;
        state.wake.as_ref().ok_or(-8)?.wake().map_err(|_| -8)
    }
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct ReadKey {
    owner: OwnerTicket,
}
pub struct ReadCompletion {
    pub key: ReadKey,
    pub result: Result<Vec<u8>, i32>,
}

/// Maximum16 in-flight/quarantined reads,256 output bytes per returned batch.
/// Returned owned results are subject to embedding delivery budgets. No internal
/// threads; drive blocks a bounded I/O owner, never the guest executor thread.
pub struct ReadReactor {
    supervisor: NativeOwnerSupervisor<NonblockingTcpRead>,
    entries: BTreeMap<usize, OwnerTicket>,
    control: Arc<Mutex<Control>>,
    poll: Poll,
    events: Events,
    next: usize,
    limit: usize,
    poisoned: bool,
}
impl ReadReactor {
    pub fn new(limit: usize) -> Result<Self, i32> {
        let supervisor = NativeOwnerSupervisor::new(limit)?;
        let poll = Poll::new().map_err(|_| -8)?;
        let wake = Waker::new(poll.registry(), Token(0)).map_err(|_| -8)?;
        Ok(Self {
            supervisor,
            entries: BTreeMap::new(),
            control: Arc::new(Mutex::new(Control {
                pending: BTreeMap::new(),
                wake: Some(wake),
            })),
            poll,
            events: Events::with_capacity(17),
            next: 1,
            limit,
            poisoned: false,
        })
    }
    /// Reject before registration on quota/exhaustion; ownership is returned.
    /// Private readiness tokens never reuse within this queue, including failure.
    pub fn admit(
        &mut self,
        mut read: NonblockingTcpRead,
    ) -> Result<(ReadKey, ReactorCancellation), (i32, NonblockingTcpRead)> {
        if self.poisoned {
            return Err((-8, read));
        }
        if self.entries.len() >= self.limit {
            return Err((-3, read));
        }
        if self.next > 32767 {
            if !self.entries.is_empty() || self.supervisor.counts() != [0, 0] {
                return Err((-3, read));
            }
            if let Err(code) = self.rotate_idle_queue() {
                return Err((code, read));
            }
        }
        let id = self.next;
        self.next += 1;
        if let Err(code) = read.register(self.poll.registry(), Token(id)) {
            return Err((code, read));
        }
        let ticket = self.supervisor.admit(read, 16)?;
        self.entries.insert(id, ticket);
        self.control
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .pending
            .insert(id, false);
        Ok((
            ReadKey { owner: ticket },
            ReactorCancellation {
                id,
                control: Arc::clone(&self.control),
            },
        ))
    }
    pub fn counts(&self) -> [usize; 2] {
        self.supervisor.counts()
    }
    /// Rotate only after every old operation has settled and released its pins.
    /// Old cancellation capabilities retain the old, empty Control, never the
    /// new queue's numeric IDs. All fallible setup precedes namespace retirement.
    fn rotate_idle_queue(&mut self) -> Result<(), i32> {
        let poll = Poll::new().map_err(|_| -8)?;
        let wake = Waker::new(poll.registry(), Token(0)).map_err(|_| -8)?;
        let control = Arc::new(Mutex::new(Control {
            pending: BTreeMap::new(),
            wake: Some(wake),
        }));
        let mut old = self.control.lock().map_err(|_| -8)?;
        if !old.pending.is_empty() {
            return Err(-8);
        }
        old.wake.take();
        drop(old);
        self.poll = poll;
        self.control = control;
        self.events = Events::with_capacity(17);
        self.next = 1;
        Ok(())
    }
    fn scan(&mut self) -> Result<Vec<ReadCompletion>, i32> {
        let mut completed = Vec::with_capacity(self.entries.len());
        // At most16 syscalls per wake, including spurious events. A ready socket
        // cannot starve another operation's cancellation or absolute deadline.
        for id in self.entries.keys().copied().collect::<Vec<_>>() {
            let ticket = self.entries[&id];
            let cancel = *self
                .control
                .lock()
                .map_err(|_| -8)?
                .pending
                .get(&id)
                .ok_or(-8)?;
            let read = self.supervisor.endpoint_mut(ticket)?;
            if cancel {
                let _ = read.cancel();
            }
            if let ReadProgress::Settled(mut result) = read.poll(Instant::now())? {
                // Delivery linearizes against cancellation under the same lock.
                let cancelled = self
                    .control
                    .lock()
                    .map_err(|_| -8)?
                    .pending
                    .remove(&id)
                    .ok_or(-8)?;
                if cancelled {
                    result = Err(-10);
                }
                let (bytes, error) = match result {
                    Ok(bytes) => (bytes, 0),
                    Err(error) => (Vec::new(), error),
                };
                let result = self.supervisor.finish_settled(ticket, &bytes, error);
                if self.supervisor.resource_counts(ticket).is_ok() {
                    return Err(-8);
                }
                self.entries.remove(&id);
                completed.push(ReadCompletion {
                    key: ReadKey { owner: ticket },
                    result,
                });
            }
        }
        Ok(completed)
    }
    /// Return a finite batch as soon as any operation settles, or empty if idle.
    /// Fatal errors retain ownership and poison admission until outer teardown.
    pub fn drive(&mut self) -> Result<Vec<ReadCompletion>, i32> {
        if self.poisoned {
            return Err(-8);
        }
        let result = self.drive_inner();
        if result.is_err() {
            self.poisoned = true;
        }
        result
    }
    fn drive_inner(&mut self) -> Result<Vec<ReadCompletion>, i32> {
        loop {
            let completed = self.scan()?;
            if !completed.is_empty() || self.entries.is_empty() {
                return Ok(completed);
            }
            let mut deadline = None;
            for ticket in self.entries.values() {
                let at = self.supervisor.endpoint_mut(*ticket)?.deadline();
                deadline = Some(deadline.map_or(at, |previous: Instant| previous.min(at)));
            }
            let timeout = deadline.map(|at| at.saturating_duration_since(Instant::now()));
            match self.poll.poll(&mut self.events, timeout) {
                Ok(()) => (),
                Err(e) if e.kind() == io::ErrorKind::Interrupted => (),
                Err(_) => return Err(-8),
            }
        }
    }
}
impl Drop for ReadReactor {
    fn drop(&mut self) {
        let mut state = self.control.lock().unwrap_or_else(|p| p.into_inner());
        state.pending.clear();
        state.wake.take(); // Retained cancellation capabilities own no OS queue.
                           // Supervisor drops all owned descriptors; no successful delivery/replay.
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::Write,
        net::{TcpListener, TcpStream},
        thread,
        time::Duration,
    };
    fn read(duration: Duration) -> (NonblockingTcpRead, TcpStream) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let peer = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        (
            NonblockingTcpRead::new(listener.accept().unwrap().0, 16, Instant::now() + duration)
                .unwrap_or_else(|_| panic!("read")),
            peer,
        )
    }
    fn admit(
        reactor: &mut ReadReactor,
        duration: Duration,
    ) -> (ReadKey, ReactorCancellation, TcpStream) {
        let (read, peer) = read(duration);
        let (key, cancel) = reactor.admit(read).unwrap_or_else(|_| panic!("admit"));
        (key, cancel, peer)
    }
    #[test]
    fn sixteen_ready_reads_share_one_queue_and_deliver_once() {
        let mut reactor = ReadReactor::new(16).unwrap();
        let mut keys = Vec::new();
        let mut peers = Vec::new();
        for i in 0..16u8 {
            let (key, cancel, mut peer) = admit(&mut reactor, Duration::from_secs(2));
            peer.write_all(&[i]).unwrap();
            keys.push((key, cancel, i));
            peers.push(peer);
        }
        let mut total = 0;
        while reactor.counts() != [0, 0] {
            for completed in reactor.drive().unwrap() {
                let (_, cancel, expected) =
                    keys.iter().find(|(k, _, _)| *k == completed.key).unwrap();
                assert_eq!(completed.result.unwrap(), [*expected]);
                assert_eq!(cancel.cancel(), Err(-1));
                total += 1;
            }
        }
        assert_eq!(total, 16);
        assert!(reactor.drive().unwrap().is_empty());
    }
    #[test]
    fn independent_cancel_success_and_deadline_do_not_cross_deliver() {
        let mut reactor = ReadReactor::new(3).unwrap();
        let (a, cancel, _p1) = admit(&mut reactor, Duration::from_secs(2));
        let (b, _c2, mut p2) = admit(&mut reactor, Duration::from_secs(2));
        let (c, _c3, _p3) = admit(&mut reactor, Duration::from_millis(60));
        cancel.cancel().unwrap();
        p2.write_all(b"ok").unwrap();
        let mut seen = Vec::new();
        while reactor.counts() != [0, 0] {
            for item in reactor.drive().unwrap() {
                assert!(!seen.contains(&item.key));
                seen.push(item.key);
                if item.key == a {
                    assert_eq!(item.result, Err(-10));
                } else if item.key == b {
                    assert_eq!(item.result.unwrap(), b"ok");
                } else {
                    assert!(item.key == c);
                    assert_eq!(item.result, Err(-9));
                }
            }
        }
        assert_eq!(seen.len(), 3);
    }
    #[test]
    fn cross_thread_cancel_wakes_shared_wait_without_cancelling_other_read() {
        let mut reactor = ReadReactor::new(2).unwrap();
        let (key, cancel, _peer) = admit(&mut reactor, Duration::from_secs(10));
        let (_other, _c2, _p2) = admit(&mut reactor, Duration::from_secs(10));
        let start = Instant::now();
        let mut reactor = thread::scope(|scope| {
            let worker = scope.spawn(move || {
                let batch = reactor.drive().unwrap();
                (reactor, batch)
            });
            thread::sleep(Duration::from_millis(40));
            cancel.cancel().unwrap();
            let (reactor, batch) = worker.join().unwrap();
            assert_eq!(batch.len(), 1);
            assert!(batch[0].key == key);
            assert_eq!(batch[0].result, Err(-10));
            reactor
        });
        assert!(start.elapsed() < Duration::from_secs(2));
        assert_eq!(reactor.counts(), [1, 0]);
        let id = *reactor.entries.keys().next().unwrap();
        reactor.control.lock().unwrap().pending.insert(id, true);
        assert_eq!(reactor.drive().unwrap().len(), 1);
    }
    #[test]
    fn cancelled_request_keeps_quota_and_rejected_read_ownership() {
        let mut reactor = ReadReactor::new(1).unwrap();
        let (_key, cancel, _peer) = admit(&mut reactor, Duration::from_secs(2));
        cancel.cancel().unwrap();
        assert_eq!(reactor.counts(), [1, 0]);
        let (read, _peer2) = read(Duration::from_secs(2));
        let returned = match reactor.admit(read) {
            Err((-3, read)) => read,
            _ => panic!("quota"),
        };
        assert!(!returned.close_acknowledged());
        assert_eq!(reactor.drive().unwrap()[0].result, Err(-10));
        let (_key, next) = reactor.admit(returned).unwrap_or_else(|_| panic!("reuse"));
        assert_eq!(cancel.cancel(), Err(-1));
        next.cancel().unwrap();
        assert_eq!(reactor.drive().unwrap()[0].result, Err(-10));
    }
    #[test]
    fn idle_token_exhaustion_rotates_queue_without_reviving_old_cancel() {
        let mut reactor = ReadReactor::new(1).unwrap();
        let (_, cancel, _peer) = admit(&mut reactor, Duration::from_secs(2));
        cancel.cancel().unwrap();
        reactor.drive().unwrap();
        reactor.next = 32768;
        let (_, next, mut peer) = admit(&mut reactor, Duration::from_secs(2));
        assert_eq!(next.id, cancel.id);
        assert!(!Arc::ptr_eq(&next.control, &cancel.control));
        assert!(cancel.control.lock().unwrap().wake.is_none());
        assert_eq!(cancel.cancel(), Err(-1));
        peer.write_all(b"new").unwrap();
        assert_eq!(reactor.drive().unwrap()[0].result.as_ref().unwrap(), b"new");
        assert_eq!(next.cancel(), Err(-1));
        assert_eq!(reactor.counts(), [0, 0]);
    }
    #[test]
    fn exhausted_queue_retains_live_owner_and_rejected_descriptor() {
        let mut reactor = ReadReactor::new(2).unwrap();
        reactor.next = 32767;
        let (_, cancel, _peer) = admit(&mut reactor, Duration::from_secs(2));
        let (read, _peer2) = read(Duration::from_secs(2));
        let read = match reactor.admit(read) {
            Err((-3, read)) => read,
            _ => panic!("exhausted active queue must reject"),
        };
        assert!(!read.close_acknowledged());
        assert_eq!(reactor.counts(), [1, 0]);
        cancel.cancel().unwrap();
        assert_eq!(reactor.drive().unwrap()[0].result, Err(-10));
        let (_, next) = reactor
            .admit(read)
            .unwrap_or_else(|_| panic!("idle recovery"));
        next.cancel().unwrap();
        assert_eq!(reactor.drive().unwrap()[0].result, Err(-10));
        assert_eq!(reactor.counts(), [0, 0]);
    }
    #[test]
    fn invalid_limits_and_drop_reject_stale_cancellation() {
        for limit in [0, 17, usize::MAX] {
            assert!(matches!(ReadReactor::new(limit), Err(-5)));
        }
        let mut reactor = ReadReactor::new(1).unwrap();
        let (_, cancel, _peer) = admit(&mut reactor, Duration::from_secs(2));
        drop(reactor);
        assert_eq!(cancel.cancel(), Err(-1));
        assert!(cancel.control.lock().unwrap().wake.is_none());
    }
    #[test]
    fn inconsistent_backend_state_poison_retains_pin_and_denies_new_admission() {
        let mut reactor = ReadReactor::new(1).unwrap();
        let (_, cancel, _peer) = admit(&mut reactor, Duration::from_secs(2));
        let ticket = *reactor.entries.values().next().unwrap();
        // Backend has settled without passing through correlated delivery.
        let read = reactor.supervisor.endpoint_mut(ticket).unwrap();
        read.cancel().unwrap();
        assert!(matches!(
            read.poll(Instant::now()),
            Ok(ReadProgress::Settled(Err(-10)))
        ));
        assert!(matches!(reactor.drive(), Err(-4)));
        assert_eq!(reactor.counts(), [1, 0]);
        assert_eq!(reactor.supervisor.resource_counts(ticket).unwrap(), [1, 1]);
        let (next, _next_peer) = super::tests::read(Duration::from_secs(2));
        assert!(matches!(reactor.admit(next), Err((-8, _))));
        assert!(matches!(reactor.drive(), Err(-8)));
        drop(reactor);
        assert_eq!(cancel.cancel(), Err(-1));
    }
}
