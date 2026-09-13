//! Preopened single-read owner; no listener, DNS, reactor or guest ABI.
use std::{
    io::{self, Read},
    net::TcpStream,
    time::Instant,
};

#[derive(Debug, PartialEq, Eq)]
pub enum ReadProgress {
    Pending,
    Settled(Result<Vec<u8>, i32>),
}

/// Embedding admits this owner under its finite supervisor quota before polling.
/// The preopened descriptor must not have aliases that the embedding expects us
/// to close. No thread, detached syscall, allocation on Pending or read replay.
pub struct NonblockingTcpRead {
    stream: Option<OwnedStream>,
    capacity: usize,
    deadline: Instant,
    cancelled: bool,
}
#[cfg(feature = "native-readiness")]
enum OwnedStream {
    Plain(TcpStream),
    Registered(mio::net::TcpStream),
}
#[cfg(feature = "native-readiness")]
impl Read for OwnedStream {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        match self {
            Self::Plain(s) => s.read(bytes),
            Self::Registered(s) => s.read(bytes),
        }
    }
}
#[cfg(not(feature = "native-readiness"))]
type OwnedStream = TcpStream;
impl NonblockingTcpRead {
    /// Failure returns ownership of the descriptor to its caller.
    pub fn new(
        stream: TcpStream,
        capacity: usize,
        deadline: Instant,
    ) -> Result<Self, (i32, TcpStream)> {
        if !(1..=16).contains(&capacity) {
            return Err((-5, stream));
        }
        if stream.set_nonblocking(true).is_err() {
            return Err((-8, stream));
        }
        Ok(Self {
            stream: Some(Self::owned_stream(stream)),
            capacity,
            deadline,
            cancelled: false,
        })
    }
    #[cfg(feature = "native-readiness")]
    fn owned_stream(stream: TcpStream) -> OwnedStream {
        OwnedStream::Plain(stream)
    }
    #[cfg(not(feature = "native-readiness"))]
    fn owned_stream(stream: TcpStream) -> OwnedStream {
        stream
    }
    #[cfg(feature = "native-readiness")]
    pub(crate) fn register(&mut self, registry: &mio::Registry) -> Result<(), i32> {
        let stream = self.stream.take().ok_or(-4)?;
        let mut registered = match stream {
            OwnedStream::Plain(s) => mio::net::TcpStream::from_std(s),
            already @ OwnedStream::Registered(_) => {
                self.stream = Some(already);
                return Err(-4);
            }
        };
        let result = registry
            .register(&mut registered, mio::Token(0), mio::Interest::READABLE)
            .map_err(|_| -8);
        self.stream = Some(OwnedStream::Registered(registered));
        result
    }
    #[cfg(feature = "native-readiness")]
    pub(crate) fn deadline(&self) -> Instant {
        self.deadline
    }
    /// Request only: a live descriptor/quota stays owned until poll closes it.
    pub fn cancel(&mut self) -> Result<(), i32> {
        if self.stream.is_none() || self.cancelled {
            return Err(-4);
        }
        self.cancelled = true;
        Ok(())
    }
    /// Caller serializes polling and supplies monotonic time. At most one
    /// nonblocking read per call. An embedding reactor must arrange readiness,
    /// cancellation and timer wakeups; polling alone is not an async executor.
    pub fn poll(&mut self, now: Instant) -> Result<ReadProgress, i32> {
        if self.stream.is_none() {
            return Err(-4);
        }
        let result = if self.cancelled {
            Err(-10)
        } else if now >= self.deadline {
            Err(-9)
        } else {
            let mut bytes = [0u8; 16];
            match self
                .stream
                .as_mut()
                .unwrap()
                .read(&mut bytes[..self.capacity])
            {
                Ok(n) => Ok(bytes[..n].to_vec()), // Empty success is EOF, not Pending.
                Err(e)
                    if matches!(
                        e.kind(),
                        io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
                    ) =>
                {
                    return Ok(ReadProgress::Pending)
                }
                Err(_) => Err(-8),
            }
        };
        // The only issued read has returned; close our descriptor before
        // publishing settlement, even on EOF/error/cancel/deadline.
        drop(self.stream.take());
        Ok(ReadProgress::Settled(result))
    }
    pub fn close_acknowledged(&self) -> bool {
        self.stream.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{io::Write, net::TcpListener, time::Duration};
    fn pair() -> (TcpStream, TcpStream) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let peer = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        (listener.accept().unwrap().0, peer)
    }
    fn owner(capacity: usize) -> (NonblockingTcpRead, TcpStream) {
        let (stream, peer) = pair();
        let read =
            NonblockingTcpRead::new(stream, capacity, Instant::now() + Duration::from_secs(2))
                .unwrap_or_else(|_| panic!("admit"));
        (read, peer)
    }
    fn settle(read: &mut NonblockingTcpRead) -> Result<Vec<u8>, i32> {
        let until = Instant::now() + Duration::from_secs(1);
        loop {
            match read.poll(Instant::now()).unwrap() {
                ReadProgress::Settled(r) => return r,
                ReadProgress::Pending => {
                    assert!(Instant::now() < until, "read never became ready");
                    std::thread::sleep(Duration::from_millis(1));
                }
            }
        }
    }
    #[test]
    fn no_data_is_pending_and_retains_descriptor() {
        let (mut read, _peer) = owner(16);
        assert_eq!(read.poll(Instant::now()).unwrap(), ReadProgress::Pending);
        assert!(!read.close_acknowledged());
    }
    #[test]
    fn real_data_closes_before_delivery_and_never_replays() {
        let (mut read, mut peer) = owner(16);
        peer.write_all(b"abc").unwrap();
        assert_eq!(settle(&mut read).unwrap(), b"abc");
        assert!(read.close_acknowledged());
        assert_eq!(read.poll(Instant::now()).unwrap_err(), -4);
        assert_eq!(read.cancel(), Err(-4));
    }
    #[test]
    fn capacity_bounds_actual_socket_read() {
        let (mut read, mut peer) = owner(2);
        peer.write_all(b"abcdef").unwrap();
        assert_eq!(settle(&mut read).unwrap(), b"ab");
        assert!(read.close_acknowledged());
    }
    #[test]
    fn cancel_request_is_not_close_ack_and_suppresses_ready_bytes() {
        let (mut read, mut peer) = owner(16);
        peer.write_all(b"secret").unwrap();
        read.cancel().unwrap();
        assert!(!read.close_acknowledged());
        assert_eq!(read.cancel(), Err(-4));
        assert_eq!(settle(&mut read), Err(-10));
        assert!(read.close_acknowledged());
    }
    #[test]
    fn deadline_wins_before_read_even_when_data_ready() {
        let (mut read, mut peer) = owner(16);
        peer.write_all(b"late").unwrap();
        assert_eq!(
            read.poll(read.deadline).unwrap(),
            ReadProgress::Settled(Err(-9))
        );
        assert!(read.close_acknowledged());
    }
    #[test]
    fn cancel_has_deterministic_precedence_over_deadline() {
        let (mut read, _peer) = owner(16);
        read.cancel().unwrap();
        assert_eq!(
            read.poll(read.deadline).unwrap(),
            ReadProgress::Settled(Err(-10))
        );
    }
    #[test]
    fn peer_eof_is_empty_settlement_not_busy_loop() {
        let (mut read, peer) = owner(16);
        drop(peer);
        assert_eq!(settle(&mut read).unwrap(), b"");
        assert!(read.close_acknowledged());
    }
    #[test]
    fn invalid_capacity_returns_usable_descriptor() {
        for capacity in [0, 17, usize::MAX] {
            let (stream, mut peer) = pair();
            let (code, mut returned) =
                match NonblockingTcpRead::new(stream, capacity, Instant::now()) {
                    Err(e) => e,
                    Ok(_) => panic!("invalid admission"),
                };
            assert_eq!(code, -5);
            returned
                .set_read_timeout(Some(Duration::from_secs(1)))
                .unwrap();
            peer.write_all(b"x").unwrap();
            let mut byte = [0];
            returned.read_exact(&mut byte).unwrap();
            assert_eq!(byte, *b"x");
        }
    }
}
