//! One preopened connected datagram owner; no DNS, bind authority or guest ABI.
use crate::{
    nonblocking_tcp::ReadProgress,
    readiness::{ReadyRead, ReadyReadOwner},
};
use std::{io, net::UdpSocket, time::Instant};

pub struct NonblockingUdpRead {
    socket: Option<mio::net::UdpSocket>,
    capacity: usize,
    deadline: Instant,
    cancelled: bool,
}
pub type ReadyUdpRead = ReadyRead<NonblockingUdpRead>;
impl NonblockingUdpRead {
    /// Failure retains descriptor ownership. Connection/peer policy must already
    /// be admitted by embedding; no arbitrary sender address enters this profile.
    pub fn new(
        socket: UdpSocket,
        capacity: usize,
        deadline: Instant,
    ) -> Result<Self, (i32, UdpSocket)> {
        if !(1..=16).contains(&capacity) {
            return Err((-5, socket));
        }
        if socket.peer_addr().is_err() {
            return Err((-1, socket));
        }
        if socket.set_nonblocking(true).is_err() {
            return Err((-8, socket));
        }
        Ok(Self {
            socket: Some(mio::net::UdpSocket::from_std(socket)),
            capacity,
            deadline,
            cancelled: false,
        })
    }
}
impl ReadyReadOwner for NonblockingUdpRead {
    fn register(&mut self, registry: &mio::Registry, token: mio::Token) -> Result<(), i32> {
        registry
            .register(
                self.socket.as_mut().ok_or(-4)?,
                token,
                mio::Interest::READABLE,
            )
            .map_err(|_| -8)
    }
    fn deadline(&self) -> Instant {
        self.deadline
    }
    fn cancel(&mut self) -> Result<(), i32> {
        if self.socket.is_none() || self.cancelled {
            return Err(-4);
        }
        self.cancelled = true;
        Ok(())
    }
    fn poll(&mut self, now: Instant) -> Result<ReadProgress, i32> {
        let socket = self.socket.as_ref().ok_or(-4)?;
        let result = if self.cancelled {
            Err(-10)
        } else if now >= self.deadline {
            Err(-9)
        } else {
            // One extra byte detects ANY message exceeding the caller budget.
            // Oversized message is consumed and fails; never silently truncate.
            let mut bytes = [0u8; 17];
            match socket.recv(&mut bytes[..self.capacity + 1]) {
                Ok(n) if n <= self.capacity => Ok(bytes[..n].to_vec()),
                Ok(_) => Err(-5),
                // Winsock reports oversized UDP as WSAEMSGSIZE instead of a
                // truncated byte count; excess message bytes are discarded.
                // https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-recv
                Err(e) if cfg!(windows) && e.raw_os_error() == Some(10040) => Err(-5),
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
        drop(self.socket.take()); // Own descriptor closed BEFORE settlement.
        Ok(ReadProgress::Settled(result))
    }
    fn close_acknowledged(&self) -> bool {
        self.socket.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{thread, time::Duration};
    fn pair() -> (UdpSocket, UdpSocket) {
        let read = UdpSocket::bind("127.0.0.1:0").unwrap();
        let peer = UdpSocket::bind("127.0.0.1:0").unwrap();
        read.connect(peer.local_addr().unwrap()).unwrap();
        peer.connect(read.local_addr().unwrap()).unwrap();
        (read, peer)
    }
    #[test]
    fn message_boundaries_empty_and_oversize_are_not_stream_eof_or_truncation() {
        for data in [vec![], vec![7; 16], vec![9; 17], vec![1; 64]] {
            let (socket, peer) = pair();
            let read = NonblockingUdpRead::new(socket, 16, Instant::now() + Duration::from_secs(2))
                .unwrap_or_else(|_| panic!("owner"));
            let (mut ready, cancel) = ReadyUdpRead::new(read).unwrap_or_else(|_| panic!("ready"));
            peer.send(&data).unwrap();
            let result = ready.wait();
            assert_eq!(result, if data.len() <= 16 { Ok(data) } else { Err(-5) });
            assert!(ready.close_acknowledged());
            assert_eq!(ready.wait(), Err(-4));
            assert_eq!(cancel.cancel(), Err(-1));
        }
    }
    #[test]
    fn actual_os_pending_wait_cancel_and_deadline_close_before_publication() {
        for cancel_wait in [true, false] {
            let (socket, _peer) = pair();
            let deadline =
                Instant::now() + Duration::from_millis(if cancel_wait { 2000 } else { 50 });
            let read =
                NonblockingUdpRead::new(socket, 16, deadline).unwrap_or_else(|_| panic!("owner"));
            let (mut ready, cancel) = ReadyUdpRead::new(read).unwrap_or_else(|_| panic!("ready"));
            let (tx, rx) = std::sync::mpsc::channel();
            let worker = thread::spawn(move || {
                let result = ready.wait();
                assert!(ready.os_wait_count() > 0);
                assert!(ready.close_acknowledged());
                tx.send(result).unwrap();
            });
            assert!(rx.recv_timeout(Duration::from_millis(10)).is_err());
            if cancel_wait {
                cancel.cancel().unwrap();
            }
            assert_eq!(
                rx.recv_timeout(Duration::from_secs(2)).unwrap(),
                Err(if cancel_wait { -10 } else { -9 })
            );
            worker.join().unwrap();
            assert_eq!(cancel.cancel(), Err(-1));
        }
    }
    #[test]
    fn admission_returns_descriptor_and_cancel_precedes_ready_message_deadline() {
        let (socket, peer) = pair();
        let (code, socket) = NonblockingUdpRead::new(socket, 17, Instant::now())
            .err()
            .unwrap();
        assert_eq!(code, -5);
        peer.send(b"ready").unwrap();
        let mut read =
            NonblockingUdpRead::new(socket, 16, Instant::now()).unwrap_or_else(|_| panic!("owner"));
        read.cancel().unwrap();
        assert_eq!(
            read.poll(Instant::now()).unwrap(),
            ReadProgress::Settled(Err(-10))
        );
        assert!(read.close_acknowledged());
        let unconnected = UdpSocket::bind("127.0.0.1:0").unwrap();
        assert_eq!(
            NonblockingUdpRead::new(unconnected, 16, Instant::now())
                .err()
                .unwrap()
                .0,
            -1
        );
    }
}
