//! Opt-in Native owner wait; not a guest Future, runtime executor or worker pool.
use crate::{
    nonblocking_tcp::{NonblockingTcpRead, ReadProgress},
    owner_supervisor::QuarantineEndpoint,
};
use mio::{Events, Poll, Token, Waker};
use std::{
    io,
    sync::{Arc, Mutex},
    time::Instant,
};

struct Control {
    cancelled: bool,
    terminal: bool,
    wake: Option<Waker>,
}
/// Single issued cancellation capability. Old handles never target a new read.
pub struct ReadCancellation {
    control: Arc<Mutex<Control>>,
}
impl ReadCancellation {
    pub fn cancel(&self) -> Result<(), i32> {
        let mut state = self.control.lock().map_err(|_| -8)?;
        if state.terminal {
            return Err(-1);
        }
        if state.cancelled {
            return Err(-4);
        }
        state.cancelled = true;
        state.wake.as_ref().ok_or(-8)?.wake().map_err(|_| -8)
    }
}

/// One preopened read, one OS event queue, one wakeup and four event slots.
/// Admit under a finite NativeOwnerSupervisor before wait. No thread is spawned;
/// the embedding runs wait on its bounded I/O owner, not a guest executor thread.
pub struct ReadyTcpRead {
    read: NonblockingTcpRead,
    poll: Poll,
    events: Events,
    control: Arc<Mutex<Control>>,
    waits: usize,
}
impl ReadyTcpRead {
    /// Registration failure returns the read owner, retaining its descriptor.
    pub fn new(
        mut read: NonblockingTcpRead,
    ) -> Result<(Self, ReadCancellation), (i32, NonblockingTcpRead)> {
        let setup = (|| {
            let poll = Poll::new().map_err(|_| -8)?;
            let wake = Waker::new(poll.registry(), Token(1)).map_err(|_| -8)?;
            read.register(poll.registry(), Token(0))?;
            Ok::<_, i32>((poll, wake))
        })();
        let (poll, wake) = match setup {
            Ok(p) => p,
            Err(code) => return Err((code, read)),
        };
        let control = Arc::new(Mutex::new(Control {
            cancelled: false,
            terminal: false,
            wake: Some(wake),
        }));
        let cancel = ReadCancellation {
            control: Arc::clone(&control),
        };
        Ok((
            Self {
                read,
                poll,
                events: Events::with_capacity(4),
                control,
                waits: 0,
            },
            cancel,
        ))
    }
    fn finish(&mut self, result: Result<Vec<u8>, i32>) -> Result<Vec<u8>, i32> {
        let mut state = self.control.lock().map_err(|_| -8)?;
        state.terminal = true;
        state.wake.take(); // Old cancellation handles retain no OS wakeup.
        if state.cancelled {
            Err(-10)
        } else {
            result
        }
    }
    pub fn wait(&mut self) -> Result<Vec<u8>, i32> {
        if self.read.close_acknowledged() {
            return Err(-4);
        }
        loop {
            if self.control.lock().map_err(|_| -8)?.cancelled {
                let _ = self.read.cancel();
            }
            match self.read.poll(Instant::now())? {
                ReadProgress::Settled(result) => return self.finish(result),
                ReadProgress::Pending => (),
            }
            self.waits += 1;
            // Absolute deadline is re-evaluated after spurious/EINTR wakes.
            let timeout = self
                .read
                .deadline()
                .saturating_duration_since(Instant::now());
            match self.poll.poll(&mut self.events, Some(timeout)) {
                Ok(()) => (),
                Err(e) if e.kind() == io::ErrorKind::Interrupted => (),
                Err(_) => {
                    let _ = self.read.cancel();
                    let _ = self.read.poll(Instant::now());
                    return self.finish(Err(-8));
                }
            }
        }
    }
    pub fn os_wait_count(&self) -> usize {
        self.waits
    }
    pub fn close_acknowledged(&self) -> bool {
        self.read.close_acknowledged()
    }
}
impl QuarantineEndpoint for ReadyTcpRead {
    fn acknowledge_close(&mut self) -> Result<(), i32> {
        if self.close_acknowledged() {
            Ok(())
        } else {
            Err(-4)
        }
    }
    fn acknowledge_quarantine_close(&mut self) -> Result<(), i32> {
        if !self.close_acknowledged() {
            let _ = self.read.cancel();
            if !matches!(
                self.read.poll(Instant::now())?,
                ReadProgress::Settled(Err(-10))
            ) {
                return Err(-8);
            }
        }
        let _ = self.finish(Err(-10));
        self.acknowledge_close()
    }
    fn retire(&mut self) -> Result<(), i32> {
        self.acknowledge_close()
    }
}
impl Drop for ReadyTcpRead {
    fn drop(&mut self) {
        // No user code executes under this mutex; preserve closure even if poisoned.
        let mut state = self.control.lock().unwrap_or_else(|p| p.into_inner());
        state.terminal = true;
        state.wake.take();
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
    fn owner(duration: Duration) -> (ReadyTcpRead, ReadCancellation, TcpStream) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let peer = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let read =
            NonblockingTcpRead::new(listener.accept().unwrap().0, 16, Instant::now() + duration)
                .unwrap_or_else(|_| panic!("read"));
        let (ready, cancel) = ReadyTcpRead::new(read).unwrap_or_else(|_| panic!("ready"));
        (ready, cancel, peer)
    }
    #[test]
    fn actual_readiness_wakes_without_fixed_interval_polling() {
        let (mut read, cancel, mut peer) = owner(Duration::from_secs(2));
        thread::scope(|scope| {
            scope.spawn(move || {
                thread::sleep(Duration::from_millis(40));
                peer.write_all(b"ready").unwrap();
            });
            assert_eq!(read.wait().unwrap(), b"ready");
        });
        assert!((1..=8).contains(&read.os_wait_count()));
        assert!(read.close_acknowledged());
        assert_eq!(cancel.cancel(), Err(-1));
        assert_eq!(read.wait(), Err(-4));
    }
    #[test]
    fn deadline_wakes_without_network_activity() {
        let (mut read, _cancel, _peer) = owner(Duration::from_millis(60));
        assert_eq!(read.wait(), Err(-9));
        assert!((1..=8).contains(&read.os_wait_count()));
        assert!(read.close_acknowledged());
    }
    #[test]
    fn cross_thread_cancel_wakes_os_wait_before_long_deadline() {
        let (mut read, cancel, _peer) = owner(Duration::from_secs(10));
        let start = Instant::now();
        thread::scope(|scope| {
            let worker = scope.spawn(move || {
                let result = read.wait();
                (result, read)
            });
            thread::sleep(Duration::from_millis(40));
            cancel.cancel().unwrap();
            let (result, read) = worker.join().unwrap();
            assert_eq!(result, Err(-10));
            assert!(read.close_acknowledged());
            assert!((1..=8).contains(&read.os_wait_count()));
        });
        assert!(start.elapsed() < Duration::from_secs(2));
        assert_eq!(cancel.cancel(), Err(-1));
    }
    #[test]
    fn cancellation_before_wait_suppresses_ready_input() {
        let (mut read, cancel, mut peer) = owner(Duration::from_secs(2));
        peer.write_all(b"secret").unwrap();
        cancel.cancel().unwrap();
        assert_eq!(cancel.cancel(), Err(-4));
        assert_eq!(read.wait(), Err(-10));
        assert_eq!(read.os_wait_count(), 0);
    }
    #[test]
    fn stale_cancel_cannot_retain_wakeup_or_cancel_another_owner() {
        let (read, cancel, _peer) = owner(Duration::from_secs(2));
        drop(read);
        assert_eq!(cancel.cancel(), Err(-1));
        assert!(cancel.control.lock().unwrap().wake.is_none());
        let (mut next, _next_cancel, mut peer) = owner(Duration::from_secs(2));
        peer.write_all(b"next").unwrap();
        assert_eq!(next.wait().unwrap(), b"next");
    }
    #[test]
    fn quarantine_cleanup_closes_and_retires_real_readiness_owner() {
        let (read, cancel, _peer) = owner(Duration::from_secs(2));
        let mut supervisor = crate::owner_supervisor::NativeOwnerSupervisor::new(1).unwrap();
        let ticket = supervisor
            .admit(read, 16)
            .unwrap_or_else(|_| panic!("admit"));
        assert_eq!(supervisor.finish_settled(ticket, b"fake", 0), Err(-4));
        assert_eq!(supervisor.counts(), [0, 1]);
        assert_eq!(supervisor.resource_counts(ticket).unwrap(), [1, 1]);
        supervisor.retire_quarantine(ticket).unwrap();
        assert_eq!(supervisor.counts(), [0, 0]);
        assert_eq!(cancel.cancel(), Err(-1));
    }
}
